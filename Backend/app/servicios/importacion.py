import hashlib
import json
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path

from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import Categoria, Importacion, Producto, Usuario, Venta
from app.errores import (
    ConflictoImportacion,
    ErrorFila,
    ErrorValidacionArchivo,
    OperacionNoPermitida,
    ResultadoImportacion,
)
from app.schemas.importacion import ArchivoDemo, MetadataDemo, VentaImportada
from app.servicios.usuarios import normalizar_correo


def _leer_json(ruta: Path) -> object:
    try:
        return json.loads(ruta.read_text(encoding="utf-8"), parse_float=Decimal)
    except UnicodeDecodeError as exc:
        raise ErrorValidacionArchivo(
            ruta.name,
            [ErrorFila(ruta.name, None, "archivo", "El archivo no esta codificado en UTF-8.")],
        ) from exc
    except json.JSONDecodeError as exc:
        raise ErrorValidacionArchivo(
            ruta.name,
            [ErrorFila(ruta.name, None, "archivo", f"JSON invalido: {exc.msg}.")],
        ) from exc
    except OSError as exc:
        raise ErrorValidacionArchivo(
            ruta.name,
            [ErrorFila(ruta.name, None, "archivo", f"No se pudo leer el archivo: {exc.strerror}.")],
        ) from exc


def _errores_pydantic(
    archivo: str,
    fila: int | None,
    exc: ValidationError,
    prefijo: str = "",
) -> list[ErrorFila]:
    errores: list[ErrorFila] = []
    for error in exc.errors():
        ubicacion = ".".join(str(parte) for parte in error.get("loc", ()))
        campo = f"{prefijo}{ubicacion}" if prefijo else ubicacion
        mensaje = str(error.get("msg", "Valor invalido.")).removeprefix("Value error, ")
        errores.append(ErrorFila(archivo, fila, campo or "registro", mensaje))
    return errores


def cargar_archivo(ruta: Path | str) -> ArchivoDemo:
    ruta = Path(ruta)
    try:
        contenido = ruta.read_bytes()
    except OSError as exc:
        raise ErrorValidacionArchivo(
            ruta.name,
            [
                ErrorFila(
                    ruta.name,
                    None,
                    "archivo",
                    f"No se pudo leer el archivo: {exc.strerror or exc}.",
                )
            ],
        ) from exc
    hash_sha256 = hashlib.sha256(contenido).hexdigest()
    datos = _leer_json(ruta)

    if not isinstance(datos, dict):
        raise ErrorValidacionArchivo(
            ruta.name,
            [ErrorFila(ruta.name, None, "archivo", "El contenido debe ser un objeto JSON.")],
        )

    errores: list[ErrorFila] = []
    metadata_cruda = datos.get("metadata")
    ventas_crudas = datos.get("ventas")

    if not isinstance(metadata_cruda, dict):
        errores.append(ErrorFila(ruta.name, None, "metadata", "Falta el objeto metadata o no es un objeto."))
        metadata = None
    else:
        try:
            metadata = MetadataDemo.model_validate(metadata_cruda)
        except ValidationError as exc:
            errores.extend(_errores_pydantic(ruta.name, None, exc, prefijo="metadata."))
            metadata = None

    if not isinstance(ventas_crudas, list):
        errores.append(ErrorFila(ruta.name, None, "ventas", "Falta la lista ventas o no es una lista."))
        ventas_crudas = []

    if metadata is not None and metadata.cantidad_registros != len(ventas_crudas):
        errores.append(
            ErrorFila(
                ruta.name,
                None,
                "metadata.cantidad_registros",
                "La cantidad declarada no coincide con el numero de ventas.",
            )
        )

    ventas: list[VentaImportada] = []
    vistos: set[str] = set()
    catalogo: dict[str, tuple[str, str]] = {}
    hoy = date.today()

    for indice, venta_cruda in enumerate(ventas_crudas, start=1):
        if not isinstance(venta_cruda, dict):
            errores.append(ErrorFila(ruta.name, indice, "venta", "Cada venta debe ser un objeto."))
            continue
        try:
            venta = VentaImportada.model_validate(venta_cruda)
        except ValidationError as exc:
            errores.extend(_errores_pydantic(ruta.name, indice, exc))
            continue

        if venta.id_venta in vistos:
            errores.append(
                ErrorFila(ruta.name, indice, "id_venta", "El identificador de venta esta repetido en el archivo.")
            )
        else:
            vistos.add(venta.id_venta)

        if metadata is not None:
            if not (metadata.periodo_inicio <= venta.fecha <= metadata.periodo_fin):
                errores.append(
                    ErrorFila(ruta.name, indice, "fecha", "La fecha esta fuera del periodo declarado.")
                )
        if venta.fecha < date(2000, 1, 1):
            errores.append(ErrorFila(ruta.name, indice, "fecha", "La fecha es anterior al limite permitido."))
        if venta.fecha > hoy + timedelta(days=1):
            errores.append(ErrorFila(ruta.name, indice, "fecha", "La fecha no puede ser futura."))

        anterior = catalogo.get(venta.producto_id)
        if anterior is not None and anterior != (venta.producto, venta.categoria):
            errores.append(
                ErrorFila(
                    ruta.name,
                    indice,
                    "producto",
                    "El producto tiene nombre o categoria distintos dentro del archivo.",
                )
            )
        else:
            catalogo[venta.producto_id] = (venta.producto, venta.categoria)

        ventas.append(venta)

    if errores:
        raise ErrorValidacionArchivo(ruta.name, errores)

    assert metadata is not None
    return ArchivoDemo(
        ruta=str(ruta),
        nombre=ruta.name,
        hash_sha256=hash_sha256,
        metadata=metadata,
        ventas=tuple(ventas),
    )


def cargar_directorio(directorio: Path | str) -> list[ArchivoDemo]:
    directorio = Path(directorio)
    rutas = sorted(directorio.glob("*.json"))
    if not rutas:
        raise ErrorValidacionArchivo(
            str(directorio),
            [ErrorFila(str(directorio), None, "directorio", "No se encontraron archivos JSON.")],
        )
    archivos = [cargar_archivo(ruta) for ruta in rutas]
    conjuntos: set[str] = set()
    errores: list[ErrorFila] = []
    for archivo in archivos:
        if archivo.metadata.conjunto in conjuntos:
            errores.append(
                ErrorFila(
                    archivo.nombre,
                    None,
                    "metadata.conjunto",
                    "El conjunto esta repetido entre los archivos del directorio.",
                )
            )
        conjuntos.add(archivo.metadata.conjunto)
    if errores:
        raise ErrorValidacionArchivo(str(directorio), errores)
    return archivos


def sembrar_catalogo_demo(session: Session, archivos: list[ArchivoDemo]) -> tuple[int, int]:
    categorias: dict[str, Categoria] = {
        categoria.nombre: categoria for categoria in session.scalars(select(Categoria)).all()
    }
    productos: dict[str, Producto] = {
        producto.id: producto for producto in session.scalars(select(Producto)).all()
    }
    catalogo_archivos: dict[str, tuple[str, str, Decimal]] = {}
    errores: list[ErrorFila] = []

    for archivo in archivos:
        for indice, venta in enumerate(archivo.ventas, start=1):
            anterior = catalogo_archivos.get(venta.producto_id)
            actual = (venta.producto, venta.categoria, venta.precio_unitario_mxn)
            if anterior is not None and anterior[:2] != actual[:2]:
                errores.append(
                    ErrorFila(
                        archivo.nombre,
                        indice,
                        "producto",
                        "El producto tiene nombre o categoria distintos entre archivos.",
                    )
                )
            else:
                catalogo_archivos[venta.producto_id] = actual

    if errores:
        raise ErrorValidacionArchivo("catalogo", errores)

    for nombre in sorted({valor[1] for valor in catalogo_archivos.values()}):
        if nombre not in categorias:
            categoria = Categoria(nombre=nombre)
            session.add(categoria)
            session.flush()
            categorias[nombre] = categoria

    for producto_id in sorted(catalogo_archivos):
        nombre, categoria_nombre, precio = catalogo_archivos[producto_id]
        categoria = categorias[categoria_nombre]
        producto = productos.get(producto_id)
        if producto is None:
            producto = Producto(
                id=producto_id,
                nombre=nombre,
                categoria_id=categoria.id,
                precio_actual_mxn=precio,
                activo=True,
            )
            session.add(producto)
            productos[producto_id] = producto
        else:
            producto.nombre = nombre
            producto.categoria_id = categoria.id
            producto.precio_actual_mxn = precio
            producto.activo = True
            producto.actualizado_en = func.now()
    session.flush()
    return len(categorias), len(productos)


def _validar_propietario(session: Session, propietario_id) -> Usuario:
    propietario = session.get(Usuario, propietario_id)
    if propietario is None:
        raise OperacionNoPermitida("El propietario de la importacion no existe.")
    if not propietario.activo:
        raise OperacionNoPermitida("El propietario de la importacion esta inactivo.")
    if propietario.rol != "cliente":
        raise OperacionNoPermitida("El propietario de la importacion debe ser una cuenta cliente.")
    return propietario


def importar_archivo(
    session: Session,
    archivo: ArchivoDemo,
    *,
    propietario_id,
    importado_por=None,
) -> ResultadoImportacion:
    _validar_propietario(session, propietario_id)

    existente = session.scalar(select(Importacion).where(Importacion.conjunto == archivo.metadata.conjunto))
    if existente is not None:
        if existente.hash_sha256 == archivo.hash_sha256:
            return ResultadoImportacion(
                archivo=archivo.nombre,
                conjunto=archivo.metadata.conjunto,
                estado="ya_importado",
                ventas_insertadas=0,
                ventas_existentes=existente.cantidad_registros,
                importacion_id=existente.id,
            )
        raise ConflictoImportacion(
            archivo.metadata.conjunto,
            "El conjunto ya existe con un contenido distinto.",
        )

    mismo_hash = session.scalar(select(Importacion).where(Importacion.hash_sha256 == archivo.hash_sha256))
    if mismo_hash is not None:
        raise ConflictoImportacion(
            archivo.metadata.conjunto,
            f"El mismo contenido ya fue importado como {mismo_hash.conjunto}.",
        )

    productos = {
        producto.id: producto
        for producto in session.scalars(
            select(Producto).where(Producto.id.in_({venta.producto_id for venta in archivo.ventas}))
        ).all()
    }
    categorias = {
        categoria.id: categoria.nombre
        for categoria in session.scalars(select(Categoria)).all()
    }
    errores: list[ErrorFila] = []
    for indice, venta in enumerate(archivo.ventas, start=1):
        producto = productos.get(venta.producto_id)
        if producto is None:
            errores.append(
                ErrorFila(archivo.nombre, indice, "producto_id", "El producto no existe en el catalogo.")
            )
            continue
        if categorias.get(producto.categoria_id) != venta.categoria:
            errores.append(
                ErrorFila(archivo.nombre, indice, "categoria", "La categoria no coincide con el catalogo.")
            )
    if errores:
        raise ErrorValidacionArchivo(archivo.nombre, errores)

    importacion = Importacion(
        conjunto=archivo.metadata.conjunto,
        archivo=archivo.nombre,
        hash_sha256=archivo.hash_sha256,
        perfil_demanda=archivo.metadata.perfil_demanda,
        fuente="datos_simulados",
        es_demostracion=True,
        moneda=archivo.metadata.moneda,
        periodo_inicio=archivo.metadata.periodo_inicio,
        periodo_fin=archivo.metadata.periodo_fin,
        cantidad_registros=archivo.metadata.cantidad_registros,
        propietario_id=propietario_id,
        importado_por=importado_por,
    )
    session.add(importacion)
    session.flush()

    for venta in archivo.ventas:
        session.add(
            Venta(
                importacion_id=importacion.id,
                id_origen=venta.id_venta,
                propietario_id=propietario_id,
                fecha=venta.fecha,
                producto_id=venta.producto_id,
                precio_unitario_mxn=venta.precio_unitario_mxn,
                cantidad=venta.cantidad,
                total_mxn=venta.total_mxn,
            )
        )
    session.flush()
    return ResultadoImportacion(
        archivo=archivo.nombre,
        conjunto=archivo.metadata.conjunto,
        estado="importado",
        ventas_insertadas=len(archivo.ventas),
        importacion_id=importacion.id,
    )


def cargar_demo(
    session: Session,
    directorio: Path | str,
    *,
    propietario_id,
    importado_por=None,
    sembrar_catalogo: bool = True,
) -> list[ResultadoImportacion]:
    archivos = cargar_directorio(directorio)
    if sembrar_catalogo:
        sembrar_catalogo_demo(session, archivos)
    return [
        importar_archivo(
            session,
            archivo,
            propietario_id=propietario_id,
            importado_por=importado_por,
        )
        for archivo in archivos
    ]


def obtener_importaciones(session: Session) -> list[Importacion]:
    return list(session.scalars(select(Importacion).order_by(Importacion.conjunto.asc())).all())


def buscar_propietario_por_correo(session: Session, correo: str) -> Usuario | None:
    return session.scalar(select(Usuario).where(Usuario.correo == normalizar_correo(correo)))

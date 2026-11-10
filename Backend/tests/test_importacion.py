import dataclasses
import json
import uuid
from decimal import Decimal
from pathlib import Path

import pytest
from sqlalchemy import func, select

from app.db.models import Importacion, Venta
from app.errores import (
    ConflictoImportacion,
    ErrorValidacionArchivo,
    OperacionNoPermitida,
)
from app.servicios.importacion import (
    cargar_archivo,
    cargar_demo,
    cargar_directorio,
    importar_archivo,
    sembrar_catalogo_demo,
)
from app.servicios.usuarios import crear_cliente
from tests.conftest import CLAVE_PRUEBA, DEMO_DIR


def _leer_json(nombre: str = "ventas_sucursal_demo_01.json") -> dict:
    return json.loads((DEMO_DIR / nombre).read_text(encoding="utf-8"))


def _escribir_variante(tmp_path: Path, datos: dict, nombre: str = "variante.json") -> Path:
    ruta = tmp_path / nombre
    ruta.write_text(json.dumps(datos, ensure_ascii=False), encoding="utf-8")
    return ruta


def test_cargar_archivo_valido(archivos_demo):
    archivo = archivos_demo[0]

    assert archivo.nombre == "ventas_sucursal_demo_01.json"
    assert len(archivo.hash_sha256) == 64
    assert archivo.metadata.conjunto == "sucursal_demo_01"
    assert archivo.metadata.cantidad_registros == 100
    assert len(archivo.ventas) == 100
    assert sum(venta.cantidad for venta in archivo.ventas) == 250
    assert sum(venta.total_mxn for venta in archivo.ventas) == Decimal("7897.00")


def test_cargar_directorio_encuentra_los_cinco_conjuntos(archivos_demo):
    assert len(archivos_demo) == 5
    assert {archivo.metadata.conjunto for archivo in archivos_demo} == {
        "sucursal_demo_01",
        "sucursal_demo_02",
        "sucursal_demo_03",
        "sucursal_demo_04",
        "sucursal_demo_05",
    }
    assert sum(len(archivo.ventas) for archivo in archivos_demo) == 500
    assert sum(sum(v.cantidad for v in archivo.ventas) for archivo in archivos_demo) == 1287
    assert sum(sum(v.total_mxn for v in archivo.ventas) for archivo in archivos_demo) == Decimal(
        "36404.00"
    )


def test_archivo_con_fecha_invalida_es_rechazado(tmp_path):
    datos = _leer_json()
    datos["ventas"][0]["fecha"] = "2026-13-01"
    ruta = _escribir_variante(tmp_path, datos)

    with pytest.raises(ErrorValidacionArchivo) as excinfo:
        cargar_archivo(ruta)

    error = excinfo.value.errores[0]
    assert error.fila == 1
    assert error.campo == "fecha"


def test_archivo_con_cantidad_cero_es_rechazado(tmp_path):
    datos = _leer_json()
    datos["ventas"][0]["cantidad"] = 0
    ruta = _escribir_variante(tmp_path, datos)

    with pytest.raises(ErrorValidacionArchivo) as excinfo:
        cargar_archivo(ruta)

    assert any(error.fila == 1 and error.campo == "cantidad" for error in excinfo.value.errores)


def test_archivo_con_total_incoherente_es_rechazado(tmp_path):
    datos = _leer_json()
    datos["ventas"][0]["total_mxn"] = datos["ventas"][0]["total_mxn"] + 1
    ruta = _escribir_variante(tmp_path, datos)

    with pytest.raises(ErrorValidacionArchivo) as excinfo:
        cargar_archivo(ruta)

    assert any(
        error.fila == 1
        and (error.campo == "total_mxn" or "total" in error.motivo.lower())
        for error in excinfo.value.errores
    )


def test_archivo_con_campo_faltante_es_rechazado(tmp_path):
    datos = _leer_json()
    datos["ventas"][0].pop("cantidad")
    ruta = _escribir_variante(tmp_path, datos)

    with pytest.raises(ErrorValidacionArchivo) as excinfo:
        cargar_archivo(ruta)

    assert any(error.fila == 1 and "cantidad" in error.campo for error in excinfo.value.errores)


def test_archivo_inexistente_es_error_controlado(tmp_path):
    with pytest.raises(ErrorValidacionArchivo) as excinfo:
        cargar_archivo(tmp_path / "no-existe.json")

    assert excinfo.value.errores[0].campo == "archivo"


def test_categoria_demasiado_larga_es_rechazada(tmp_path):
    datos = _leer_json()
    datos["ventas"][0]["categoria"] = "X" * 61
    ruta = _escribir_variante(tmp_path, datos)

    with pytest.raises(ErrorValidacionArchivo) as excinfo:
        cargar_archivo(ruta)

    assert any(error.fila == 1 and error.campo == "categoria" for error in excinfo.value.errores)


def test_precio_con_mas_de_dos_decimales_es_rechazado(tmp_path):
    datos = _leer_json()
    datos["ventas"][0]["precio_unitario_mxn"] = 31.001
    ruta = _escribir_variante(tmp_path, datos)

    with pytest.raises(ErrorValidacionArchivo) as excinfo:
        cargar_archivo(ruta)

    assert any(
        error.fila == 1 and error.campo == "precio_unitario_mxn"
        for error in excinfo.value.errores
    )


def test_archivo_con_cantidad_declarada_incorrecta_es_rechazado(tmp_path):
    datos = _leer_json()
    datos["metadata"]["cantidad_registros"] = 99
    ruta = _escribir_variante(tmp_path, datos)

    with pytest.raises(ErrorValidacionArchivo) as excinfo:
        cargar_archivo(ruta)

    assert any(
        error.campo == "metadata.cantidad_registros" for error in excinfo.value.errores
    )


def test_archivo_con_id_repetido_es_rechazado(tmp_path):
    datos = _leer_json()
    datos["ventas"][1]["id_venta"] = datos["ventas"][0]["id_venta"]
    ruta = _escribir_variante(tmp_path, datos)

    with pytest.raises(ErrorValidacionArchivo) as excinfo:
        cargar_archivo(ruta)

    assert any(error.fila == 2 and error.campo == "id_venta" for error in excinfo.value.errores)


def test_archivo_con_producto_inconsistente_es_rechazado(tmp_path):
    datos = _leer_json()
    datos["ventas"][0]["producto"] = "Producto distinto"
    ruta = _escribir_variante(tmp_path, datos)

    with pytest.raises(ErrorValidacionArchivo) as excinfo:
        cargar_archivo(ruta)

    assert any("producto" in error.campo for error in excinfo.value.errores)


def test_archivo_sin_ventas_es_rechazado(tmp_path):
    datos = _leer_json()
    datos["ventas"] = []
    datos["metadata"]["cantidad_registros"] = 1
    ruta = _escribir_variante(tmp_path, datos)

    with pytest.raises(ErrorValidacionArchivo):
        cargar_archivo(ruta)


def test_importar_archivo_valido_persiste_ventas_y_origen(session, catalogo, cliente, archivos_demo):
    archivo = archivos_demo[0]
    resultado = importar_archivo(
        session,
        archivo,
        propietario_id=cliente.id,
    )
    session.commit()

    assert resultado.estado == "importado"
    assert resultado.ventas_insertadas == 100
    assert session.scalar(select(func.count(Venta.id))) == 100

    importacion = session.scalar(select(Importacion))
    assert importacion is not None
    assert importacion.conjunto == "sucursal_demo_01"
    assert importacion.propietario_id == cliente.id
    assert importacion.es_demostracion is True
    assert importacion.fuente == "datos_simulados"

    ventas = session.scalars(select(Venta)).all()
    assert all(venta.propietario_id == cliente.id for venta in ventas)
    assert all(venta.importacion_id == importacion.id for venta in ventas)
    assert all(venta.id_origen for venta in ventas)


def test_reimportar_el_mismo_archivo_es_idempotente(session, catalogo, cliente, archivos_demo):
    archivo = archivos_demo[0]
    primero = importar_archivo(session, archivo, propietario_id=cliente.id)
    session.commit()
    segundo = importar_archivo(session, archivo, propietario_id=cliente.id)
    session.commit()

    assert primero.estado == "importado"
    assert segundo.estado == "ya_importado"
    assert segundo.ventas_insertadas == 0
    assert segundo.importacion_id == primero.importacion_id
    assert session.scalar(select(func.count(Venta.id))) == 100


def test_mismo_conjunto_con_contenido_distinto_es_conflicto(session, catalogo, cliente, archivos_demo):
    archivo = archivos_demo[0]
    importar_archivo(session, archivo, propietario_id=cliente.id)
    session.commit()

    variante = dataclasses.replace(archivo, hash_sha256="f" * 64)
    with pytest.raises(ConflictoImportacion):
        importar_archivo(session, variante, propietario_id=cliente.id)


def test_mismo_hash_con_otro_conjunto_es_conflicto(session, catalogo, cliente, archivos_demo):
    archivo = archivos_demo[0]
    importar_archivo(session, archivo, propietario_id=cliente.id)
    session.commit()

    variante = dataclasses.replace(
        archivo,
        metadata=archivo.metadata.model_copy(update={"conjunto": "otro_conjunto"}),
    )
    with pytest.raises(ConflictoImportacion):
        importar_archivo(session, variante, propietario_id=cliente.id)


def test_producto_fuera_del_catalogo_es_rechazado(session, catalogo, cliente, archivos_demo):
    archivo = archivos_demo[0]
    venta_mala = archivo.ventas[0].model_copy(update={"producto_id": "Z999"})
    variante = dataclasses.replace(
        archivo,
        nombre="producto_desconocido.json",
        hash_sha256="a" * 64,
        ventas=(venta_mala,) + archivo.ventas[1:],
    )

    with pytest.raises(ErrorValidacionArchivo) as excinfo:
        importar_archivo(session, variante, propietario_id=cliente.id)

    assert any(error.campo == "producto_id" for error in excinfo.value.errores)
    assert session.scalar(select(func.count(Importacion.id))) == 0


def test_categoria_fuera_del_catalogo_es_rechazada(session, catalogo, cliente, archivos_demo):
    archivo = archivos_demo[0]
    venta_mala = archivo.ventas[0].model_copy(update={"categoria": "Categoria inexistente"})
    variante = dataclasses.replace(
        archivo,
        nombre="categoria_desconocida.json",
        hash_sha256="b" * 64,
        ventas=(venta_mala,) + archivo.ventas[1:],
    )

    with pytest.raises(ErrorValidacionArchivo) as excinfo:
        importar_archivo(session, variante, propietario_id=cliente.id)

    assert any(error.campo == "categoria" for error in excinfo.value.errores)


def test_fallo_a_mitad_de_la_carga_no_deja_datos(session, catalogo, cliente, archivos_demo):
    archivo_valido = archivos_demo[0]
    archivo_malo = archivos_demo[1]
    venta_mala = archivo_malo.ventas[0].model_copy(update={"producto_id": "Z999"})
    archivo_malo = dataclasses.replace(
        archivo_malo,
        ventas=(venta_mala,) + archivo_malo.ventas[1:],
    )

    with pytest.raises(ErrorValidacionArchivo):
        with session.begin():
            importar_archivo(session, archivo_valido, propietario_id=cliente.id)
            importar_archivo(session, archivo_malo, propietario_id=cliente.id)

    assert session.scalar(select(func.count(Importacion.id))) == 0
    assert session.scalar(select(func.count(Venta.id))) == 0


def test_propietario_debe_ser_cliente_activo(session, catalogo, admin, archivos_demo):
    with pytest.raises(OperacionNoPermitida):
        importar_archivo(session, archivos_demo[0], propietario_id=admin.id)

    with pytest.raises(OperacionNoPermitida):
        importar_archivo(session, archivos_demo[0], propietario_id=uuid.uuid4())


def test_cargar_demo_completo_y_repetible(session, archivos_demo):
    cliente = crear_cliente(
        session,
        nombre="Cliente Demo",
        correo="demo@example.com",
        password=CLAVE_PRUEBA,
    )
    session.commit()

    resultados = cargar_demo(session, DEMO_DIR, propietario_id=cliente.id)
    session.commit()

    assert [resultado.estado for resultado in resultados] == ["importado"] * 5
    assert sum(resultado.ventas_insertadas for resultado in resultados) == 500
    assert session.scalar(select(func.count(Importacion.id))) == 5
    assert session.scalar(select(func.count(Venta.id))) == 500
    assert session.scalar(select(func.sum(Venta.cantidad))) == 1287
    assert session.scalar(select(func.sum(Venta.total_mxn))) == Decimal("36404.00")

    repetidos = cargar_demo(session, DEMO_DIR, propietario_id=cliente.id)
    session.commit()

    assert [resultado.estado for resultado in repetidos] == ["ya_importado"] * 5
    assert session.scalar(select(func.count(Importacion.id))) == 5
    assert session.scalar(select(func.count(Venta.id))) == 500


def test_sembrar_catalogo_crea_categorias_y_productos(session, archivos_demo):
    categorias, productos = sembrar_catalogo_demo(session, archivos_demo)
    session.commit()

    assert categorias == 6
    assert productos == 41

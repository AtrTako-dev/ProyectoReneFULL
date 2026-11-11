import uuid
from datetime import date, timedelta
from decimal import Decimal

from pydantic import ValidationError
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from app.db.models import Categoria, Importacion, Producto, Usuario, Venta
from app.errores import NoEncontrado, RegistroInvalido
from app.schemas.ventas import PaginaVentas, VentaLeida

_TOLERANCIA_TOTAL = Decimal("0.01")


def _columnas_venta():
    return (
        Venta.id,
        Venta.propietario_id,
        Venta.fecha,
        Venta.producto_id,
        Producto.nombre.label("producto"),
        Categoria.nombre.label("categoria"),
        Venta.precio_unitario_mxn,
        Venta.cantidad,
        Venta.total_mxn,
        Venta.importacion_id,
        Venta.id_origen,
        func.coalesce(Importacion.es_demostracion, False).label("es_demostracion"),
    )


def _filtros_base(propietario_id: uuid.UUID | None, desde: date | None, hasta: date | None):
    filtros = []
    if propietario_id is not None:
        filtros.append(Venta.propietario_id == propietario_id)
    if desde is not None:
        filtros.append(Venta.fecha >= desde)
    if hasta is not None:
        filtros.append(Venta.fecha <= hasta)
    return filtros


def _filtros_validez(hoy: date):
    return [
        Venta.fecha >= date(2000, 1, 1),
        Venta.fecha <= hoy + timedelta(days=1),
        Venta.cantidad >= 1,
        Venta.cantidad <= 10000,
        Venta.precio_unitario_mxn > 0,
        Venta.precio_unitario_mxn <= 1000000,
        Venta.total_mxn > 0,
        Venta.total_mxn <= 10000000,
        func.abs(Venta.total_mxn - (Venta.precio_unitario_mxn * Venta.cantidad)) <= _TOLERANCIA_TOTAL,
        or_(
            Venta.id_origen.is_(None),
            and_(
                Venta.importacion_id.is_not(None),
                func.length(func.trim(Venta.id_origen)).between(1, 64),
            ),
        ),
        and_(
            Venta.importacion_id.is_(None),
            Venta.id_origen.is_(None),
        )
        | and_(
            Venta.importacion_id.is_not(None),
            Venta.id_origen.is_not(None),
            Importacion.id.is_not(None),
            Importacion.propietario_id == Venta.propietario_id,
            func.length(func.trim(Importacion.conjunto)).between(1, 80),
            Importacion.hash_sha256.op("~")(r"^[0-9a-f]{64}$"),
            Importacion.periodo_inicio <= Venta.fecha,
            Importacion.periodo_fin >= Venta.fecha,
        ),
        Producto.id.op("~")(r"^[A-Z]{1,3}[0-9]{3}$"),
        func.length(func.trim(Producto.nombre)).between(1, 120),
        func.length(func.trim(Categoria.nombre)).between(1, 60),
        Producto.precio_actual_mxn > 0,
        Usuario.activo.is_(True),
        func.length(func.trim(Usuario.nombre)).between(1, 120),
        func.length(Usuario.correo).between(3, 254),
        Usuario.correo == func.lower(Usuario.correo),
        Usuario.correo.like("%@%.%"),
    ]


def consulta_ventas(
    *,
    propietario_id: uuid.UUID | None,
    desde: date | None = None,
    hasta: date | None = None,
    hoy: date | None = None,
    venta_id: int | None = None,
    solo_validas: bool = True,
):
    hoy = hoy or date.today()
    consulta = (
        select(*_columnas_venta())
        .join(Producto, Venta.producto_id == Producto.id)
        .join(Categoria, Producto.categoria_id == Categoria.id)
        .join(Usuario, Venta.propietario_id == Usuario.id)
        .outerjoin(Importacion, Venta.importacion_id == Importacion.id)
        .where(*_filtros_base(propietario_id, desde, hasta))
    )
    if venta_id is not None:
        consulta = consulta.where(Venta.id == venta_id)
    if solo_validas:
        consulta = consulta.where(*_filtros_validez(hoy))
    return consulta.order_by(Venta.fecha.asc(), Venta.id.asc())


def _total_ventas(
    session: Session,
    *,
    propietario_id: uuid.UUID | None,
    desde: date | None,
    hasta: date | None,
) -> int:
    consulta = select(func.count(Venta.id)).where(*_filtros_base(propietario_id, desde, hasta))
    return int(session.scalar(consulta) or 0)


def cargar_ventas_validadas(
    session: Session,
    *,
    propietario_id: uuid.UUID | None,
    desde: date | None = None,
    hasta: date | None = None,
    hoy: date | None = None,
) -> tuple[list[VentaLeida], int]:
    hoy = hoy or date.today()
    filas = session.execute(
        consulta_ventas(
            propietario_id=propietario_id,
            desde=desde,
            hasta=hasta,
            hoy=hoy,
            solo_validas=True,
        )
    ).all()
    ventas: list[VentaLeida] = []
    for fila in filas:
        try:
            ventas.append(VentaLeida.model_validate(dict(fila._mapping), context={"hoy": hoy}))
        except ValidationError:
            continue
    total = _total_ventas(session, propietario_id=propietario_id, desde=desde, hasta=hasta)
    return ventas, max(0, total - len(ventas))


def listar_ventas_cliente(
    session: Session,
    *,
    propietario_id: uuid.UUID,
    desde: date | None = None,
    hasta: date | None = None,
    limite: int = 100,
    desplazamiento: int = 0,
    hoy: date | None = None,
) -> PaginaVentas:
    if limite < 1 or limite > 500:
        raise ValueError("El limite debe estar entre 1 y 500.")
    if desplazamiento < 0:
        raise ValueError("El desplazamiento no puede ser negativo.")
    ventas, excluidos = cargar_ventas_validadas(
        session,
        propietario_id=propietario_id,
        desde=desde,
        hasta=hasta,
        hoy=hoy,
    )
    return PaginaVentas(
        items=ventas[desplazamiento : desplazamiento + limite],
        total=len(ventas),
        limite=limite,
        desplazamiento=desplazamiento,
        registros_excluidos=excluidos,
    )


def obtener_venta_cliente(
    session: Session,
    *,
    propietario_id: uuid.UUID,
    venta_id: int,
    hoy: date | None = None,
) -> VentaLeida:
    hoy = hoy or date.today()
    venta = session.get(Venta, venta_id)
    if venta is None or venta.propietario_id != propietario_id:
        raise NoEncontrado("La venta solicitada no existe.")

    fila = session.execute(
        consulta_ventas(
            propietario_id=propietario_id,
            venta_id=venta_id,
            hoy=hoy,
            solo_validas=True,
        )
    ).first()
    if fila is None:
        raise RegistroInvalido(
            "venta",
            venta_id,
            ["La venta no cumple las reglas de validez de filas."],
        )
    try:
        return VentaLeida.model_validate(dict(fila._mapping), context={"hoy": hoy})
    except ValidationError as exc:
        motivos = [
            f"{'.'.join(str(p) for p in error.get('loc', ()))}: {error.get('msg', '')}"
            for error in exc.errors()
        ]
        raise RegistroInvalido("venta", venta_id, motivos) from exc

import calendar
import uuid
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal
from typing import Literal

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.db.models import Usuario, Venta
from app.repositorios.ventas import cargar_ventas_validadas
from app.schemas.analitica import (
    ClienteEstadistica,
    EstadisticaCategoria,
    EstadisticaPeriodo,
    EstadisticaProducto,
    EstadisticasAdmin,
    EstadisticasCliente,
    PeriodoEstadisticas,
    ResumenAdmin,
    ResumenEstadisticas,
)
from app.schemas.ventas import VentaLeida
from app.servicios.usuarios import verificar_actor_admin


def _dinero(valor: Decimal) -> float:
    return float(valor.quantize(Decimal("0.01")))


def _resumen(ventas: list[VentaLeida], excluidos: int) -> ResumenEstadisticas:
    return ResumenEstadisticas(
        transacciones_validas=len(ventas),
        unidades=sum(venta.cantidad for venta in ventas),
        importe_mxn=_dinero(sum((venta.total_mxn for venta in ventas), Decimal("0"))),
        registros_excluidos=excluidos,
    )


def _por_categoria(ventas: list[VentaLeida]) -> list[EstadisticaCategoria]:
    acumulado: dict[str, dict[str, Decimal | int]] = defaultdict(
        lambda: {"transacciones": 0, "unidades": 0, "importe": Decimal("0")}
    )
    for venta in ventas:
        fila = acumulado[venta.categoria]
        fila["transacciones"] = int(fila["transacciones"]) + 1
        fila["unidades"] = int(fila["unidades"]) + venta.cantidad
        fila["importe"] = Decimal(fila["importe"]) + venta.total_mxn
    return [
        EstadisticaCategoria(
            categoria=categoria,
            transacciones=int(valores["transacciones"]),
            unidades=int(valores["unidades"]),
            importe_mxn=_dinero(Decimal(valores["importe"])),
        )
        for categoria, valores in sorted(acumulado.items(), key=lambda item: item[0])
    ]


def _por_producto(ventas: list[VentaLeida]) -> list[EstadisticaProducto]:
    acumulado: dict[str, dict[str, object]] = {}
    for venta in ventas:
        fila = acumulado.setdefault(
            venta.producto_id,
            {
                "producto": venta.producto,
                "categoria": venta.categoria,
                "transacciones": 0,
                "unidades": 0,
                "importe": Decimal("0"),
            },
        )
        fila["transacciones"] = int(fila["transacciones"]) + 1
        fila["unidades"] = int(fila["unidades"]) + venta.cantidad
        fila["importe"] = Decimal(fila["importe"]) + venta.total_mxn
    resultado = [
        EstadisticaProducto(
            producto_id=producto_id,
            producto=str(valores["producto"]),
            categoria=str(valores["categoria"]),
            transacciones=int(valores["transacciones"]),
            unidades=int(valores["unidades"]),
            importe_mxn=_dinero(Decimal(valores["importe"])),
        )
        for producto_id, valores in acumulado.items()
    ]
    return sorted(resultado, key=lambda fila: (-fila.unidades, fila.producto_id))


def _periodo(fecha: date, agrupacion: Literal["semana", "mes"]) -> tuple[date, date, str]:
    if agrupacion == "semana":
        inicio = fecha - timedelta(days=fecha.weekday())
        fin = inicio + timedelta(days=6)
        iso = fecha.isocalendar()
        etiqueta = f"{iso.year}-W{iso.week:02d}"
        return inicio, fin, etiqueta
    inicio = date(fecha.year, fecha.month, 1)
    ultimo_dia = calendar.monthrange(fecha.year, fecha.month)[1]
    fin = date(fecha.year, fecha.month, ultimo_dia)
    return inicio, fin, f"{fecha.year}-{fecha.month:02d}"


def _por_periodo(
    ventas: list[VentaLeida],
    agrupacion: Literal["semana", "mes"],
    min_fecha: date | None,
    max_fecha: date | None,
) -> list[EstadisticaPeriodo]:
    acumulado: dict[tuple[date, str], dict[str, object]] = {}
    for venta in ventas:
        inicio, fin, etiqueta = _periodo(venta.fecha, agrupacion)
        clave = (inicio, venta.categoria)
        fila = acumulado.setdefault(
            clave,
            {
                "fin": fin,
                "etiqueta": etiqueta,
                "transacciones": 0,
                "unidades": 0,
                "importe": Decimal("0"),
            },
        )
        fila["transacciones"] = int(fila["transacciones"]) + 1
        fila["unidades"] = int(fila["unidades"]) + venta.cantidad
        fila["importe"] = Decimal(fila["importe"]) + venta.total_mxn
    resultado: list[EstadisticaPeriodo] = []
    for (inicio, categoria), valores in sorted(
        acumulado.items(), key=lambda item: (item[0][0], item[0][1])
    ):
        fin = valores["fin"]
        assert isinstance(fin, date)
        resultado.append(
            EstadisticaPeriodo(
                periodo_inicio=inicio,
                periodo_fin=fin,
                etiqueta=str(valores["etiqueta"]),
                completa=(
                    min_fecha is not None
                    and max_fecha is not None
                    and inicio >= min_fecha
                    and fin <= max_fecha
                ),
                categoria=categoria,
                transacciones=int(valores["transacciones"]),
                unidades=int(valores["unidades"]),
                importe_mxn=_dinero(Decimal(valores["importe"])),
            )
        )
    return resultado


def _periodo_salida(
    ventas: list[VentaLeida],
    desde: date | None,
    hasta: date | None,
    agrupacion: Literal["semana", "mes"],
) -> PeriodoEstadisticas:
    fechas = [venta.fecha for venta in ventas]
    return PeriodoEstadisticas(
        desde=desde or (min(fechas) if fechas else None),
        hasta=hasta or (max(fechas) if fechas else None),
        agrupacion=agrupacion,
    )


def estadisticas_cliente(
    session: Session,
    *,
    propietario_id: uuid.UUID,
    desde: date | None = None,
    hasta: date | None = None,
    agrupacion: Literal["semana", "mes"] = "semana",
    hoy: date | None = None,
) -> EstadisticasCliente:
    if agrupacion not in ("semana", "mes"):
        raise ValueError("La agrupacion debe ser semana o mes.")
    ventas, excluidos = cargar_ventas_validadas(
        session,
        propietario_id=propietario_id,
        desde=desde,
        hasta=hasta,
        hoy=hoy,
    )
    fechas = [venta.fecha for venta in ventas]
    min_fecha = min(fechas) if fechas else None
    max_fecha = max(fechas) if fechas else None
    periodos = _por_periodo(ventas, agrupacion, min_fecha, max_fecha)
    return EstadisticasCliente(
        periodo=_periodo_salida(ventas, desde, hasta, agrupacion),
        resumen=_resumen(ventas, excluidos),
        por_categoria=_por_categoria(ventas),
        por_semana=periodos if agrupacion == "semana" else [],
        por_mes=periodos if agrupacion == "mes" else [],
        por_producto=_por_producto(ventas),
    )


def estadisticas_clientes_admin(
    session: Session,
    *,
    actor_admin_id: uuid.UUID,
    desde: date | None = None,
    hasta: date | None = None,
    agrupacion: Literal["semana", "mes"] = "semana",
    hoy: date | None = None,
) -> EstadisticasAdmin:
    if agrupacion not in ("semana", "mes"):
        raise ValueError("La agrupacion debe ser semana o mes.")
    verificar_actor_admin(session, actor_admin_id)

    ventas, _ = cargar_ventas_validadas(
        session,
        propietario_id=None,
        desde=desde,
        hasta=hasta,
        hoy=hoy,
    )
    filtros_fecha = []
    if desde is not None:
        filtros_fecha.append(Venta.fecha >= desde)
    if hasta is not None:
        filtros_fecha.append(Venta.fecha <= hasta)
    totales_por_propietario = {
        propietario_id: int(total)
        for propietario_id, total in session.execute(
            select(Venta.propietario_id, func.count(Venta.id))
            .where(*filtros_fecha)
            .group_by(Venta.propietario_id)
        ).all()
    }

    propietarios_con_ventas = set(totales_por_propietario)
    condiciones_usuario = [Usuario.rol == "cliente"]
    if propietarios_con_ventas:
        condiciones_usuario.append(Usuario.id.in_(propietarios_con_ventas))
    usuarios = session.scalars(
        select(Usuario).where(or_(*condiciones_usuario)).order_by(Usuario.nombre.asc(), Usuario.id.asc())
    ).all()

    ventas_por_propietario: dict[uuid.UUID, list[VentaLeida]] = defaultdict(list)
    for venta in ventas:
        ventas_por_propietario[venta.propietario_id].append(venta)

    clientes: list[ClienteEstadistica] = []
    for usuario in usuarios:
        ventas_usuario = ventas_por_propietario.get(usuario.id, [])
        excluidos = max(0, totales_por_propietario.get(usuario.id, 0) - len(ventas_usuario))
        fechas = [venta.fecha for venta in ventas_usuario]
        clientes.append(
            ClienteEstadistica(
                cliente_id=usuario.id,
                nombre=usuario.nombre,
                correo=usuario.correo,
                rol_actual=usuario.rol,
                activo=usuario.activo,
                transacciones=len(ventas_usuario),
                unidades=sum(venta.cantidad for venta in ventas_usuario),
                importe_mxn=_dinero(
                    sum((venta.total_mxn for venta in ventas_usuario), Decimal("0"))
                ),
                ultima_venta=max(fechas) if fechas else None,
                registros_excluidos=excluidos,
                por_categoria=_por_categoria(ventas_usuario),
            )
        )

    fechas = [venta.fecha for venta in ventas]
    min_fecha = min(fechas) if fechas else None
    max_fecha = max(fechas) if fechas else None
    periodos = _por_periodo(ventas, agrupacion, min_fecha, max_fecha)
    resumen_base = _resumen(ventas, sum(cliente.registros_excluidos for cliente in clientes))
    return EstadisticasAdmin(
        periodo=_periodo_salida(ventas, desde, hasta, agrupacion),
        resumen=ResumenAdmin(
            **resumen_base.model_dump(),
            total_clientes=len(clientes),
        ),
        clientes=clientes,
        por_categoria=_por_categoria(ventas),
        por_semana=periodos if agrupacion == "semana" else [],
        por_mes=periodos if agrupacion == "mes" else [],
    )

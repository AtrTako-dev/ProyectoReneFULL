import uuid
from datetime import date

import pytest
from sqlalchemy import select, text

from app.db.models import Venta
from app.errores import NoEncontrado, PermisoDenegado, RegistroInvalido
from app.repositorios.ventas import (
    cargar_ventas_validadas,
    listar_ventas_cliente,
    obtener_venta_cliente,
)
from app.servicios.analitica import estadisticas_cliente, estadisticas_clientes_admin
from app.servicios.importacion import importar_archivo
from app.servicios.usuarios import crear_cliente, listar_clientes_admin
from tests.conftest import CLAVE_PRUEBA


def _crear_cliente_extra(session, correo: str):
    cliente = crear_cliente(
        session,
        nombre=f"Cliente {correo}",
        correo=correo,
        password=CLAVE_PRUEBA,
    )
    session.commit()
    return cliente


def _importar_dos_clientes(session, archivos_demo):
    cliente_a = _crear_cliente_extra(session, "cliente.a@example.com")
    cliente_b = _crear_cliente_extra(session, "cliente.b@example.com")
    importar_archivo(session, archivos_demo[0], propietario_id=cliente_a.id)
    importar_archivo(session, archivos_demo[1], propietario_id=cliente_b.id)
    session.commit()
    return cliente_a, cliente_b


def test_estadisticas_cliente_desde_base_de_datos(session, catalogo, archivos_demo):
    cliente_a, _ = _importar_dos_clientes(session, archivos_demo)
    hoy = date(2026, 12, 31)

    estadisticas = estadisticas_cliente(
        session,
        propietario_id=cliente_a.id,
        hoy=hoy,
    )

    assert estadisticas.resumen.transacciones_validas == 100
    assert estadisticas.resumen.unidades == 250
    assert estadisticas.resumen.importe_mxn == 7897.0
    assert estadisticas.resumen.registros_excluidos == 0
    assert len(estadisticas.por_categoria) == 6
    assert len(estadisticas.por_producto) == 36
    assert sum(fila.unidades for fila in estadisticas.por_categoria) == 250
    assert sum(fila.unidades for fila in estadisticas.por_producto) == 250


def test_periodos_semanales_marcan_semanas_incompletas(session, catalogo, archivos_demo):
    cliente_a, _ = _importar_dos_clientes(session, archivos_demo)
    estadisticas = estadisticas_cliente(
        session,
        propietario_id=cliente_a.id,
        hoy=date(2026, 12, 31),
    )

    por_etiqueta = {fila.etiqueta: fila for fila in estadisticas.por_semana}
    assert por_etiqueta["2026-W01"].completa is False
    assert por_etiqueta["2026-W02"].completa is True
    assert por_etiqueta["2026-W27"].completa is False
    assert any(fila.completa for fila in estadisticas.por_semana)
    assert any(not fila.completa for fila in estadisticas.por_semana)


def test_periodos_mensuales_marcan_meses_incompletos(session, catalogo, archivos_demo):
    cliente_a, _ = _importar_dos_clientes(session, archivos_demo)
    estadisticas = estadisticas_cliente(
        session,
        propietario_id=cliente_a.id,
        desde=date(2026, 1, 15),
        hasta=date(2026, 6, 15),
        agrupacion="mes",
        hoy=date(2026, 12, 31),
    )

    por_etiqueta = {fila.etiqueta: fila for fila in estadisticas.por_mes}
    assert estadisticas.por_semana == []
    assert por_etiqueta["2026-01"].completa is False
    assert por_etiqueta["2026-02"].completa is True
    assert por_etiqueta["2026-06"].completa is False


def test_cliente_sin_ventas_devuelve_estadisticas_vacias(session, catalogo):
    cliente = _crear_cliente_extra(session, "vacio@example.com")

    estadisticas = estadisticas_cliente(
        session,
        propietario_id=cliente.id,
        hoy=date(2026, 12, 31),
    )

    assert estadisticas.resumen.transacciones_validas == 0
    assert estadisticas.resumen.unidades == 0
    assert estadisticas.resumen.importe_mxn == 0.0
    assert estadisticas.periodo.desde is None
    assert estadisticas.periodo.hasta is None
    assert estadisticas.por_categoria == []
    assert estadisticas.por_producto == []


def test_aislamiento_entre_clientes(session, catalogo, archivos_demo):
    cliente_a, cliente_b = _importar_dos_clientes(session, archivos_demo)

    pagina_a = listar_ventas_cliente(session, propietario_id=cliente_a.id, limite=500)
    pagina_b = listar_ventas_cliente(session, propietario_id=cliente_b.id, limite=500)
    assert pagina_a.total == 100
    assert pagina_b.total == 100
    assert all(venta.propietario_id == cliente_a.id for venta in pagina_a.items)
    assert all(venta.propietario_id == cliente_b.id for venta in pagina_b.items)

    venta_b = session.scalar(
        select(Venta.id).where(Venta.propietario_id == cliente_b.id).limit(1)
    )
    assert venta_b is not None
    with pytest.raises(NoEncontrado):
        obtener_venta_cliente(
            session,
            propietario_id=cliente_a.id,
            venta_id=venta_b,
            hoy=date(2026, 12, 31),
        )

    with pytest.raises(NoEncontrado):
        obtener_venta_cliente(
            session,
            propietario_id=cliente_a.id,
            venta_id=999999,
            hoy=date(2026, 12, 31),
        )


def test_cambiar_propietario_no_expone_ventas_ajenas(session, catalogo, archivos_demo):
    cliente_a, cliente_b = _importar_dos_clientes(session, archivos_demo)
    venta_b = session.scalar(
        select(Venta).where(Venta.propietario_id == cliente_b.id).limit(1)
    )
    assert venta_b is not None

    with pytest.raises(NoEncontrado):
        obtener_venta_cliente(
            session,
            propietario_id=uuid.uuid4(),
            venta_id=venta_b.id,
            hoy=date(2026, 12, 31),
        )


def test_estadisticas_admin_agregan_solo_clientes(session, admin, catalogo, archivos_demo):
    cliente_a, cliente_b = _importar_dos_clientes(session, archivos_demo)

    estadisticas = estadisticas_clientes_admin(
        session,
        actor_admin_id=admin.id,
        hoy=date(2026, 12, 31),
    )

    assert estadisticas.resumen.total_clientes == 2
    assert estadisticas.resumen.transacciones_validas == 200
    assert estadisticas.resumen.unidades == 518
    assert estadisticas.resumen.importe_mxn == 14776.5
    assert {fila.cliente_id for fila in estadisticas.clientes} == {
        cliente_a.id,
        cliente_b.id,
    }
    unidades_por_cliente = {
        fila.cliente_id: fila.unidades for fila in estadisticas.clientes
    }
    assert unidades_por_cliente[cliente_a.id] == 250
    assert unidades_por_cliente[cliente_b.id] == 268


def test_admin_no_puede_ser_simulado_por_cliente(session, catalogo, archivos_demo):
    cliente_a, _ = _importar_dos_clientes(session, archivos_demo)

    with pytest.raises(PermisoDenegado):
        estadisticas_clientes_admin(
            session,
            actor_admin_id=cliente_a.id,
            hoy=date(2026, 12, 31),
        )


def test_listar_clientes_admin_no_incluye_administradores(session, admin, catalogo, archivos_demo):
    cliente_a, cliente_b = _importar_dos_clientes(session, archivos_demo)
    pagina = listar_clientes_admin(session, actor_admin_id=admin.id)

    assert pagina.total == 2
    assert {fila.id for fila in pagina.items} == {cliente_a.id, cliente_b.id}


def test_fila_invalida_es_excluida_de_estadisticas_y_falla_individual(session, catalogo, archivos_demo):
    cliente = _crear_cliente_extra(session, "invalido@example.com")
    importar_archivo(session, archivos_demo[0], propietario_id=cliente.id)
    session.commit()

    venta = session.scalar(
        select(Venta).where(Venta.propietario_id == cliente.id).limit(1)
    )
    assert venta is not None
    venta_id = venta.id

    # Se retira temporalmente la restriccion para simular una fila corrupta
    # escrita por fuera de la aplicacion. La transaccion se revierte al final.
    session.execute(text("ALTER TABLE ventas DROP CONSTRAINT ck_ventas_total_coherente"))
    session.execute(
        text("UPDATE ventas SET total_mxn = total_mxn + 100 WHERE id = :id"),
        {"id": venta_id},
    )
    session.flush()

    with pytest.raises(RegistroInvalido):
        obtener_venta_cliente(
            session,
            propietario_id=cliente.id,
            venta_id=venta_id,
            hoy=date(2026, 12, 31),
        )

    ventas, excluidos = cargar_ventas_validadas(
        session,
        propietario_id=cliente.id,
        hoy=date(2026, 12, 31),
    )
    assert len(ventas) == 99
    assert excluidos == 1

    estadisticas = estadisticas_cliente(
        session,
        propietario_id=cliente.id,
        hoy=date(2026, 12, 31),
    )
    assert estadisticas.resumen.transacciones_validas == 99
    assert estadisticas.resumen.registros_excluidos == 1


def test_venta_de_propietario_inactivo_es_invalida(session, catalogo, archivos_demo):
    cliente = _crear_cliente_extra(session, "inactivo@example.com")
    importar_archivo(session, archivos_demo[0], propietario_id=cliente.id)
    session.commit()

    venta = session.scalar(
        select(Venta).where(Venta.propietario_id == cliente.id).limit(1)
    )
    assert venta is not None
    session.execute(
        text("UPDATE usuarios SET activo = false WHERE id = :id"),
        {"id": cliente.id},
    )
    session.flush()

    with pytest.raises(RegistroInvalido):
        obtener_venta_cliente(
            session,
            propietario_id=cliente.id,
            venta_id=venta.id,
            hoy=date(2026, 12, 31),
        )

    ventas, excluidos = cargar_ventas_validadas(
        session,
        propietario_id=cliente.id,
        hoy=date(2026, 12, 31),
    )
    assert ventas == []
    assert excluidos == 100


def test_paginacion_valida_limites(session, catalogo, archivos_demo):
    cliente = _crear_cliente_extra(session, "pagina@example.com")
    importar_archivo(session, archivos_demo[0], propietario_id=cliente.id)
    session.commit()

    primera = listar_ventas_cliente(
        session,
        propietario_id=cliente.id,
        limite=10,
        desplazamiento=0,
        hoy=date(2026, 12, 31),
    )
    segunda = listar_ventas_cliente(
        session,
        propietario_id=cliente.id,
        limite=10,
        desplazamiento=10,
        hoy=date(2026, 12, 31),
    )

    assert len(primera.items) == 10
    assert len(segunda.items) == 10
    assert primera.total == 100
    assert primera.items[0].id != segunda.items[0].id

    with pytest.raises(ValueError):
        listar_ventas_cliente(session, propietario_id=cliente.id, limite=0)
    with pytest.raises(ValueError):
        listar_ventas_cliente(session, propietario_id=cliente.id, desplazamiento=-1)

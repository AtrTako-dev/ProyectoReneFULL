from datetime import date, timedelta
from decimal import Decimal

import pytest
from sqlalchemy.orm import Session

from app.db.models import Venta
from app.ml.demanda import (
    SerieSemanal,
    _construir_muestras,
    _fuente_datos,
    construir_serie,
    predecir_demanda_categoria,
    predecir_todas_las_categorias,
)
from app.repositorios.ventas import cargar_ventas_validadas
from app.schemas.ml import (
    ModeloNoSuperaLineaBase,
    PrediccionDemanda,
    SinHistorialSuficiente,
)
from app.servicios.importacion import cargar_demo
from app.servicios.usuarios import crear_cliente
from tests.conftest import CLAVE_PRUEBA, DEMO_DIR

HOY = date(2026, 12, 31)
INICIO = date(2026, 1, 5)  # lunes


def _crear_cliente(session, correo="ml@example.com"):
    cliente = crear_cliente(
        session,
        nombre="Cliente ML",
        correo=correo,
        password=CLAVE_PRUEBA,
    )
    session.commit()
    return cliente


def _insertar_ventas_semanales(
    session: Session,
    *,
    propietario_id,
    cantidades: list[int],
    producto_id: str = "B003",
    inicio: date = INICIO,
) -> None:
    for indice, cantidad in enumerate(cantidades):
        fecha = inicio + timedelta(days=7 * indice)
        total = Decimal("10.00") * cantidad
        session.add(
            Venta(
                importacion_id=None,
                id_origen=None,
                propietario_id=propietario_id,
                fecha=fecha,
                producto_id=producto_id,
                precio_unitario_mxn=Decimal("10.00"),
                cantidad=cantidad,
                total_mxn=total,
            )
        )
    session.flush()


def test_serie_semanal_solo_incluye_semanas_completas(session, catalogo):
    cliente = _crear_cliente(session)
    _insertar_ventas_semanales(
        session,
        propietario_id=cliente.id,
        cantidades=[1, 1, 1, 1, 1],
    )
    session.commit()

    ventas, excluidos = cargar_ventas_validadas(
        session,
        propietario_id=cliente.id,
        hoy=HOY,
    )
    serie = construir_serie(ventas, categoria="Bebidas")

    assert excluidos == 0
    assert len(serie.semanas) == 4
    assert serie.semanas[0] == date(2026, 1, 5)
    assert serie.unidades == (1, 1, 1, 1)


def test_construir_muestras_respeta_corte_cronologico():
    semanas = tuple(INICIO + timedelta(days=7 * i) for i in range(20))
    serie = SerieSemanal(
        categoria="Bebidas",
        semanas=semanas,
        unidades=tuple(range(1, 21)),
    )

    muestras = _construir_muestras(serie, semanas_evaluacion=5)

    assert len(muestras.x_todas) == 16
    assert len(muestras.x_entrenamiento) == 11
    assert len(muestras.x_evaluacion) == 5
    assert tuple(muestras.y_evaluacion) == (16.0, 17.0, 18.0, 19.0, 20.0)
    assert muestras.semanas_evaluacion == semanas[-5:]
    assert tuple(muestras.linea_base_evaluacion) == (15.0, 16.0, 17.0, 18.0, 19.0)


def test_cliente_sin_ventas_no_inventa_prediccion(session, catalogo):
    cliente = _crear_cliente(session, "sin.ventas@example.com")

    resultado = predecir_demanda_categoria(
        session,
        propietario_id=cliente.id,
        categoria="Bebidas",
        hoy=HOY,
    )

    assert isinstance(resultado, SinHistorialSuficiente)
    assert resultado.semanas_completas == 0
    assert resultado.semanas_con_unidades == 0
    assert resultado.motivo


def test_historial_insuficiente_no_inventa_prediccion(session, catalogo):
    cliente = _crear_cliente(session, "poco.historial@example.com")
    _insertar_ventas_semanales(
        session,
        propietario_id=cliente.id,
        cantidades=[2, 3, 4],
    )
    session.commit()

    resultado = predecir_demanda_categoria(
        session,
        propietario_id=cliente.id,
        categoria="Bebidas",
        hoy=HOY,
    )

    assert isinstance(resultado, SinHistorialSuficiente)
    assert resultado.semanas_completas < resultado.minimo_semanas_completas
    assert "No hay suficientes" in resultado.motivo


def test_modelo_que_no_supera_linea_base_no_publica_estimacion(session, catalogo):
    cliente = _crear_cliente(session, "constante@example.com")
    _insertar_ventas_semanales(
        session,
        propietario_id=cliente.id,
        cantidades=[5] * 30,
    )
    session.commit()

    resultado = predecir_demanda_categoria(
        session,
        propietario_id=cliente.id,
        categoria="Bebidas",
        hoy=HOY,
    )

    assert isinstance(resultado, ModeloNoSuperaLineaBase)
    assert resultado.metricas.supera_linea_base is False
    assert resultado.metricas.mae_modelo >= resultado.metricas.mae_linea_base
    assert resultado.motivo


def test_prediccion_con_tendencia_es_estimacion_y_es_deterministica(session, catalogo):
    cliente = _crear_cliente(session, "tendencia@example.com")
    _insertar_ventas_semanales(
        session,
        propietario_id=cliente.id,
        cantidades=[10 + 3 * i for i in range(30)],
    )
    session.commit()

    primero = predecir_demanda_categoria(
        session,
        propietario_id=cliente.id,
        categoria="Bebidas",
        hoy=HOY,
    )
    segundo = predecir_demanda_categoria(
        session,
        propietario_id=cliente.id,
        categoria="Bebidas",
        hoy=HOY,
    )

    assert primero.model_dump() == segundo.model_dump()
    assert isinstance(primero, (PrediccionDemanda, ModeloNoSuperaLineaBase))

    if isinstance(primero, PrediccionDemanda):
        assert primero.es_estimacion is True
        assert primero.unidad == "unidades"
        assert primero.objetivo == "unidades_vendidas_por_categoria_semana"
        assert primero.valores.unidades_estimadas >= 0
        assert primero.valores.unidades_redondeadas >= 0
        assert primero.metricas.supera_linea_base is True
        assert primero.metricas.mae_modelo <= primero.metricas.mae_linea_base
        assert primero.fuente_datos == "registros_propios"
        assert primero.advertencia
        assert primero.modelo.algoritmo == "Ridge"
        assert primero.modelo.semanas_evaluacion == 5
    else:
        assert primero.metricas.mae_modelo >= primero.metricas.mae_linea_base


def test_demo_carga_todas_las_categorias_y_clasifica_fuente(session, archivos_demo):
    cliente = _crear_cliente(session, "demo.ml@example.com")
    cargar_demo(session, DEMO_DIR, propietario_id=cliente.id)
    session.commit()

    ventas, _ = cargar_ventas_validadas(
        session,
        propietario_id=cliente.id,
        hoy=HOY,
    )
    assert len(ventas) == 500
    assert _fuente_datos(ventas) == "datos_simulados_de_demostracion"

    resultados = predecir_todas_las_categorias(
        session,
        propietario_id=cliente.id,
        hoy=HOY,
    )
    assert len(resultados) == 6
    assert {resultado.categoria for resultado in resultados} == {
        "Abarrotes",
        "Bebidas",
        "Botanas",
        "Higiene",
        "Limpieza",
        "Lácteos",
    }
    for resultado in resultados:
        assert isinstance(
            resultado,
            (PrediccionDemanda, SinHistorialSuficiente, ModeloNoSuperaLineaBase),
        )
        if isinstance(resultado, PrediccionDemanda):
            assert resultado.fuente_datos == "datos_simulados_de_demostracion"
            assert resultado.es_estimacion is True
            assert resultado.metricas.supera_linea_base is True

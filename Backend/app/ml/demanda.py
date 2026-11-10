import uuid
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Literal

import numpy as np
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error
from sqlalchemy.orm import Session

from app.config import get_settings
from app.repositorios.ventas import cargar_ventas_validadas
from app.schemas.ml import (
    MetricasModelo,
    ModeloInfo,
    ModeloNoSuperaLineaBase,
    PeriodoObjetivo,
    PrediccionDemanda,
    ResultadoPrediccion,
    SinHistorialSuficiente,
    ValoresPrediccion,
)
from app.schemas.ventas import VentaLeida

VARIABLES = [
    "indice_semana",
    "mes",
    "unidades_semana_anterior",
    "promedio_4_semanas_previas",
    "unidades_misma_semana_mes_anterior",
]
ALGORITMO = "Ridge"
ALPHA = 1.0
ADVERTENCIA = (
    "Estimacion semanal de unidades basada en ventas historicas. "
    "No garantiza la demanda futura."
)


@dataclass(frozen=True)
class SerieSemanal:
    categoria: str
    semanas: tuple[date, ...]
    unidades: tuple[int, ...]


@dataclass(frozen=True)
class Muestras:
    x_entrenamiento: np.ndarray
    y_entrenamiento: np.ndarray
    x_evaluacion: np.ndarray
    y_evaluacion: np.ndarray
    linea_base_evaluacion: np.ndarray
    semanas_evaluacion: tuple[date, ...]
    x_todas: np.ndarray
    y_todas: np.ndarray


def _inicio_semana(fecha: date) -> date:
    return fecha - timedelta(days=fecha.weekday())


def _semanas_completas(min_fecha: date, max_fecha: date) -> list[date]:
    inicio = _inicio_semana(min_fecha)
    if inicio < min_fecha:
        inicio += timedelta(days=7)
    semanas: list[date] = []
    while inicio + timedelta(days=6) <= max_fecha:
        semanas.append(inicio)
        inicio += timedelta(days=7)
    return semanas


def _semana_objetivo(
    semanas_completas: list[date],
    fechas: list[date],
    hoy: date,
) -> PeriodoObjetivo:
    if semanas_completas:
        inicio = semanas_completas[-1] + timedelta(days=7)
    elif fechas:
        inicio = _inicio_semana(max(fechas)) + timedelta(days=7)
    else:
        inicio = _inicio_semana(hoy) + timedelta(days=7)
    fin = inicio + timedelta(days=6)
    iso = inicio.isocalendar()
    return PeriodoObjetivo(
        semana_inicio=inicio,
        semana_fin=fin,
        semana_iso=f"{iso.year}-W{iso.week:02d}",
    )


def construir_serie(
    ventas: list[VentaLeida],
    *,
    categoria: str,
) -> SerieSemanal:
    if not categoria.strip():
        raise ValueError("La categoria es obligatoria.")
    fechas = [venta.fecha for venta in ventas]
    if not fechas:
        return SerieSemanal(categoria=categoria, semanas=(), unidades=())
    semanas = _semanas_completas(min(fechas), max(fechas))
    unidades = [0] * len(semanas)
    indice_por_semana = {semana: indice for indice, semana in enumerate(semanas)}
    for venta in ventas:
        if venta.categoria != categoria:
            continue
        inicio = _inicio_semana(venta.fecha)
        indice = indice_por_semana.get(inicio)
        if indice is not None:
            unidades[indice] += venta.cantidad
    return SerieSemanal(
        categoria=categoria,
        semanas=tuple(semanas),
        unidades=tuple(unidades),
    )


def _construir_muestras(serie: SerieSemanal, *, semanas_evaluacion: int) -> Muestras:
    semanas = list(serie.semanas)
    unidades = list(serie.unidades)
    x: list[list[float]] = []
    y: list[float] = []
    indices: list[int] = []
    for indice in range(4, len(semanas)):
        x.append(
            [
                float(indice),
                float(semanas[indice].month),
                float(unidades[indice - 1]),
                float(np.mean(unidades[indice - 4 : indice])),
                float(unidades[indice - 4]),
            ]
        )
        y.append(float(unidades[indice]))
        indices.append(indice)

    if len(x) < semanas_evaluacion + 5:
        raise ValueError("No hay suficientes observaciones para entrenar y evaluar.")

    corte = len(x) - semanas_evaluacion
    x_np = np.asarray(x, dtype=float)
    y_np = np.asarray(y, dtype=float)
    linea_base = np.asarray([unidades[indice - 1] for indice in indices], dtype=float)
    return Muestras(
        x_entrenamiento=x_np[:corte],
        y_entrenamiento=y_np[:corte],
        x_evaluacion=x_np[corte:],
        y_evaluacion=y_np[corte:],
        linea_base_evaluacion=linea_base[corte:],
        semanas_evaluacion=tuple(semanas[indice] for indice in indices[corte:]),
        x_todas=x_np,
        y_todas=y_np,
    )


def _vector_objetivo(serie: SerieSemanal) -> np.ndarray:
    semanas = list(serie.semanas)
    unidades = list(serie.unidades)
    indice = len(semanas)
    return np.asarray(
        [
            [
                float(indice),
                float((semanas[-1] + timedelta(days=7)).month),
                float(unidades[-1]),
                float(np.mean(unidades[-4:])),
                float(unidades[-4]),
            ]
        ],
        dtype=float,
    )


def _fuente_datos(ventas: list[VentaLeida]) -> str:
    if not ventas:
        return "sin_datos"
    demostracion = [venta.es_demostracion for venta in ventas]
    if all(demostracion):
        return "datos_simulados_de_demostracion"
    if any(demostracion):
        return "datos_simulados_y_registros_propios"
    return "registros_propios"


def _resultado_sin_historial(
    *,
    categoria: str,
    periodo: PeriodoObjetivo,
    serie: SerieSemanal,
    minimo_semanas_completas: int,
    minimo_semanas_con_unidades: int,
    motivo: str,
) -> SinHistorialSuficiente:
    return SinHistorialSuficiente(
        categoria=categoria,
        periodo_objetivo=periodo,
        semanas_completas=len(serie.semanas),
        semanas_con_unidades=sum(1 for unidades in serie.unidades if unidades > 0),
        minimo_semanas_completas=minimo_semanas_completas,
        minimo_semanas_con_unidades=minimo_semanas_con_unidades,
        motivo=motivo,
    )


def predecir_demanda_categoria(
    session: Session,
    *,
    propietario_id: uuid.UUID,
    categoria: str,
    desde: date | None = None,
    hasta: date | None = None,
    hoy: date | None = None,
    minimo_semanas_completas: int | None = None,
    minimo_semanas_con_unidades: int | None = None,
    semanas_evaluacion: int | None = None,
) -> ResultadoPrediccion:
    ajustes = get_settings()
    hoy = hoy or date.today()
    minimo_semanas_completas = minimo_semanas_completas or ajustes.min_semanas_entrenamiento
    minimo_semanas_con_unidades = minimo_semanas_con_unidades or ajustes.min_semanas_con_unidades
    semanas_evaluacion = semanas_evaluacion or ajustes.semanas_evaluacion

    ventas, _ = cargar_ventas_validadas(
        session,
        propietario_id=propietario_id,
        desde=desde,
        hasta=hasta,
        hoy=hoy,
    )
    serie = construir_serie(ventas, categoria=categoria)
    fechas = [venta.fecha for venta in ventas]
    periodo = _semana_objetivo(list(serie.semanas), fechas, hoy)

    if not ventas:
        return _resultado_sin_historial(
            categoria=categoria,
            periodo=periodo,
            serie=serie,
            minimo_semanas_completas=minimo_semanas_completas,
            minimo_semanas_con_unidades=minimo_semanas_con_unidades,
            motivo="No hay ventas validas para el cliente en el periodo solicitado.",
        )
    if len(serie.semanas) < minimo_semanas_completas:
        return _resultado_sin_historial(
            categoria=categoria,
            periodo=periodo,
            serie=serie,
            minimo_semanas_completas=minimo_semanas_completas,
            minimo_semanas_con_unidades=minimo_semanas_con_unidades,
            motivo="No hay suficientes semanas completas para entrenar y evaluar el modelo.",
        )
    if sum(1 for unidades in serie.unidades if unidades > 0) < minimo_semanas_con_unidades:
        return _resultado_sin_historial(
            categoria=categoria,
            periodo=periodo,
            serie=serie,
            minimo_semanas_completas=minimo_semanas_completas,
            minimo_semanas_con_unidades=minimo_semanas_con_unidades,
            motivo="No hay suficientes semanas con unidades positivas para la categoria.",
        )

    try:
        muestras = _construir_muestras(serie, semanas_evaluacion=semanas_evaluacion)
    except ValueError:
        return _resultado_sin_historial(
            categoria=categoria,
            periodo=periodo,
            serie=serie,
            minimo_semanas_completas=minimo_semanas_completas,
            minimo_semanas_con_unidades=minimo_semanas_con_unidades,
            motivo="No hay suficientes observaciones historicas para entrenar y evaluar.",
        )

    modelo_evaluacion = Ridge(alpha=ALPHA)
    modelo_evaluacion.fit(muestras.x_entrenamiento, muestras.y_entrenamiento)
    prediccion_evaluacion = np.clip(
        modelo_evaluacion.predict(muestras.x_evaluacion), a_min=0, a_max=None
    )
    mae_modelo = float(mean_absolute_error(muestras.y_evaluacion, prediccion_evaluacion))
    mae_linea_base = float(
        mean_absolute_error(muestras.y_evaluacion, muestras.linea_base_evaluacion)
    )
    metricas = MetricasModelo(
        mae_modelo=round(mae_modelo, 4),
        mae_linea_base=round(mae_linea_base, 4),
        supera_linea_base=mae_modelo < mae_linea_base,
    )

    if not metricas.supera_linea_base:
        return ModeloNoSuperaLineaBase(
            categoria=categoria,
            periodo_objetivo=periodo,
            metricas=metricas,
            motivo="El modelo no supero la linea base en la evaluacion cronologica.",
        )

    modelo_final = Ridge(alpha=ALPHA)
    modelo_final.fit(muestras.x_todas, muestras.y_todas)
    estimacion = float(np.clip(modelo_final.predict(_vector_objetivo(serie))[0], 0, None))
    return PrediccionDemanda(
        categoria=categoria,
        periodo_objetivo=periodo,
        valores=ValoresPrediccion(
            unidades_estimadas=round(estimacion, 2),
            unidades_redondeadas=int(round(estimacion)),
        ),
        modelo=ModeloInfo(
            algoritmo=ALGORITMO,
            variables=VARIABLES,
            semanas_entrenamiento=max(0, len(serie.semanas) - semanas_evaluacion),
            semanas_evaluacion=semanas_evaluacion,
        ),
        metricas=metricas,
        fuente_datos=_fuente_datos(ventas),
        advertencia=ADVERTENCIA,
    )


def predecir_todas_las_categorias(
    session: Session,
    *,
    propietario_id: uuid.UUID,
    desde: date | None = None,
    hasta: date | None = None,
    hoy: date | None = None,
) -> list[ResultadoPrediccion]:
    ventas, _ = cargar_ventas_validadas(
        session,
        propietario_id=propietario_id,
        desde=desde,
        hasta=hasta,
        hoy=hoy,
    )
    categorias = sorted({venta.categoria for venta in ventas})
    return [
        predecir_demanda_categoria(
            session,
            propietario_id=propietario_id,
            categoria=categoria,
            desde=desde,
            hasta=hasta,
            hoy=hoy,
        )
        for categoria in categorias
    ]

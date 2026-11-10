from datetime import date
from typing import Annotated, Literal, TypeAlias, Union

from pydantic import BaseModel, Field


class PeriodoObjetivo(BaseModel):
    semana_inicio: date
    semana_fin: date
    semana_iso: str


class ValoresPrediccion(BaseModel):
    unidades_estimadas: float
    unidades_redondeadas: int = Field(ge=0)


class ModeloInfo(BaseModel):
    algoritmo: str
    variables: list[str]
    semanas_entrenamiento: int = Field(ge=0)
    semanas_evaluacion: int = Field(ge=0)


class MetricasModelo(BaseModel):
    mae_modelo: float = Field(ge=0)
    mae_linea_base: float = Field(ge=0)
    supera_linea_base: bool


class PrediccionDemanda(BaseModel):
    tipo_resultado: Literal["prediccion"] = "prediccion"
    objetivo: Literal["unidades_vendidas_por_categoria_semana"] = "unidades_vendidas_por_categoria_semana"
    unidad: Literal["unidades"] = "unidades"
    categoria: str
    periodo_objetivo: PeriodoObjetivo
    valores: ValoresPrediccion
    modelo: ModeloInfo
    metricas: MetricasModelo
    es_estimacion: Literal[True] = True
    fuente_datos: str
    advertencia: str


class SinHistorialSuficiente(BaseModel):
    tipo_resultado: Literal["sin_historial_suficiente"] = "sin_historial_suficiente"
    objetivo: Literal["unidades_vendidas_por_categoria_semana"] = "unidades_vendidas_por_categoria_semana"
    unidad: Literal["unidades"] = "unidades"
    categoria: str
    periodo_objetivo: PeriodoObjetivo
    semanas_completas: int = Field(ge=0)
    semanas_con_unidades: int = Field(ge=0)
    minimo_semanas_completas: int = Field(ge=1)
    minimo_semanas_con_unidades: int = Field(ge=1)
    motivo: str
    es_estimacion: Literal[True] = True


class ModeloNoSuperaLineaBase(BaseModel):
    tipo_resultado: Literal["modelo_no_supera_linea_base"] = "modelo_no_supera_linea_base"
    objetivo: Literal["unidades_vendidas_por_categoria_semana"] = "unidades_vendidas_por_categoria_semana"
    unidad: Literal["unidades"] = "unidades"
    categoria: str
    periodo_objetivo: PeriodoObjetivo
    metricas: MetricasModelo
    motivo: str
    es_estimacion: Literal[True] = True


ResultadoPrediccion: TypeAlias = Annotated[
    Union[PrediccionDemanda, SinHistorialSuficiente, ModeloNoSuperaLineaBase],
    Field(discriminator="tipo_resultado"),
]

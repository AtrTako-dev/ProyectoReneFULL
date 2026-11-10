from datetime import date
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class PeriodoEstadisticas(BaseModel):
    desde: date | None
    hasta: date | None
    agrupacion: Literal["semana", "mes"]


class ResumenEstadisticas(BaseModel):
    transacciones_validas: int = Field(ge=0)
    unidades: int = Field(ge=0)
    importe_mxn: float = Field(ge=0)
    registros_excluidos: int = Field(ge=0, default=0)


class ResumenAdmin(ResumenEstadisticas):
    total_clientes: int = Field(ge=0)


class EstadisticaCategoria(BaseModel):
    categoria: str
    transacciones: int = Field(ge=0)
    unidades: int = Field(ge=0)
    importe_mxn: float = Field(ge=0)


class EstadisticaPeriodo(BaseModel):
    periodo_inicio: date
    periodo_fin: date
    etiqueta: str
    completa: bool
    categoria: str
    transacciones: int = Field(ge=0)
    unidades: int = Field(ge=0)
    importe_mxn: float = Field(ge=0)


class EstadisticaProducto(BaseModel):
    producto_id: str
    producto: str
    categoria: str
    transacciones: int = Field(ge=0)
    unidades: int = Field(ge=0)
    importe_mxn: float = Field(ge=0)


class EstadisticasCliente(BaseModel):
    unidad_cantidad: Literal["unidades"] = "unidades"
    periodo: PeriodoEstadisticas
    resumen: ResumenEstadisticas
    por_categoria: list[EstadisticaCategoria]
    por_semana: list[EstadisticaPeriodo] = Field(default_factory=list)
    por_mes: list[EstadisticaPeriodo] = Field(default_factory=list)
    por_producto: list[EstadisticaProducto]


class ClienteEstadistica(BaseModel):
    cliente_id: UUID
    nombre: str
    correo: str
    rol_actual: Literal["cliente", "administrador"]
    activo: bool
    transacciones: int = Field(ge=0)
    unidades: int = Field(ge=0)
    importe_mxn: float = Field(ge=0)
    ultima_venta: date | None
    registros_excluidos: int = Field(ge=0, default=0)
    por_categoria: list[EstadisticaCategoria]


class EstadisticasAdmin(BaseModel):
    unidad_cantidad: Literal["unidades"] = "unidades"
    periodo: PeriodoEstadisticas
    resumen: ResumenAdmin
    clientes: list[ClienteEstadistica]
    por_categoria: list[EstadisticaCategoria]
    por_semana: list[EstadisticaPeriodo] = Field(default_factory=list)
    por_mes: list[EstadisticaPeriodo] = Field(default_factory=list)

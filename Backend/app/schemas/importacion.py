import re
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

PRODUCTO_ID_PATRON = re.compile(r"^[A-Z]{1,3}[0-9]{3}$")
ID_ORIGEN_PATRON = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$")
TOLERANCIA_TOTAL = Decimal("0.01")


class MetadataDemo(BaseModel):
    model_config = ConfigDict(extra="forbid")

    conjunto: str = Field(min_length=1, max_length=80)
    perfil_demanda: str = Field(min_length=1, max_length=80)
    datos_simulados: Literal[True]
    moneda: Literal["MXN"]
    periodo_inicio: date
    periodo_fin: date
    cantidad_registros: int = Field(gt=0)

    @field_validator("conjunto", "perfil_demanda")
    @classmethod
    def validar_texto_metadata(cls, valor: str) -> str:
        valor = valor.strip()
        if not (1 <= len(valor) <= 80):
            raise ValueError("El texto debe tener entre 1 y 80 caracteres.")
        return valor

    @model_validator(mode="after")
    def validar_periodo(self) -> "MetadataDemo":
        if self.periodo_inicio > self.periodo_fin:
            raise ValueError("El periodo de inicio no puede ser posterior al fin.")
        return self


class VentaImportada(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id_venta: str
    fecha: date
    producto_id: str
    producto: str
    categoria: str
    precio_unitario_mxn: Decimal
    cantidad: int
    total_mxn: Decimal

    @field_validator("id_venta")
    @classmethod
    def validar_id_venta(cls, valor: str) -> str:
        valor = valor.strip()
        if not ID_ORIGEN_PATRON.fullmatch(valor):
            raise ValueError("El identificador de venta no tiene el formato esperado.")
        return valor

    @field_validator("producto_id")
    @classmethod
    def validar_producto_id(cls, valor: str) -> str:
        if not PRODUCTO_ID_PATRON.fullmatch(valor):
            raise ValueError("El identificador de producto no tiene el formato esperado.")
        return valor

    @field_validator("producto")
    @classmethod
    def validar_producto(cls, valor: str) -> str:
        valor = valor.strip()
        if not (1 <= len(valor) <= 120):
            raise ValueError("El nombre del producto debe tener entre 1 y 120 caracteres.")
        return valor

    @field_validator("categoria")
    @classmethod
    def validar_categoria(cls, valor: str) -> str:
        valor = valor.strip()
        if not (1 <= len(valor) <= 60):
            raise ValueError("La categoria debe tener entre 1 y 60 caracteres.")
        return valor

    @field_validator("precio_unitario_mxn")
    @classmethod
    def validar_precio(cls, valor: Decimal) -> Decimal:
        if not valor.is_finite() or valor <= 0 or valor > Decimal("1000000"):
            raise ValueError("El precio unitario esta fuera del rango permitido.")
        if valor != valor.quantize(Decimal("0.01")):
            raise ValueError("El precio unitario debe tener como maximo dos decimales.")
        return valor

    @field_validator("cantidad")
    @classmethod
    def validar_cantidad(cls, valor: int) -> int:
        if valor < 1 or valor > 10000:
            raise ValueError("La cantidad debe ser un entero entre 1 y 10000.")
        return valor

    @field_validator("total_mxn")
    @classmethod
    def validar_total(cls, valor: Decimal) -> Decimal:
        if not valor.is_finite() or valor <= 0 or valor > Decimal("10000000"):
            raise ValueError("El total esta fuera del rango permitido.")
        if valor != valor.quantize(Decimal("0.01")):
            raise ValueError("El total debe tener como maximo dos decimales.")
        return valor

    @model_validator(mode="after")
    def validar_coherencia(self) -> "VentaImportada":
        if abs(self.total_mxn - (self.precio_unitario_mxn * self.cantidad)) > TOLERANCIA_TOTAL:
            raise ValueError("El total no coincide con precio unitario por cantidad.")
        return self


@dataclass(frozen=True)
class ArchivoDemo:
    ruta: str
    nombre: str
    hash_sha256: str
    metadata: MetadataDemo
    ventas: tuple[VentaImportada, ...]

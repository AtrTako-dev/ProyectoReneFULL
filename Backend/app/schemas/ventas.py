import re
from datetime import date, timedelta
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, ValidationInfo, field_validator, model_validator

PRODUCTO_ID_PATRON = re.compile(r"^[A-Z]{1,3}[0-9]{3}$")
PRECIO_MAXIMO = Decimal("1000000")
TOTAL_MAXIMO = Decimal("10000000")
TOLERANCIA_TOTAL = Decimal("0.01")


class VentaLeida(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    propietario_id: UUID
    fecha: date
    producto_id: str
    producto: str
    categoria: str
    precio_unitario_mxn: Decimal
    cantidad: int
    total_mxn: Decimal
    importacion_id: int | None = None
    id_origen: str | None = None
    es_demostracion: bool = False

    @field_validator("producto_id")
    @classmethod
    def validar_producto_id(cls, valor: str) -> str:
        if not PRODUCTO_ID_PATRON.fullmatch(valor):
            raise ValueError("El identificador de producto no tiene el formato esperado.")
        return valor

    @field_validator("producto", "categoria")
    @classmethod
    def validar_texto(cls, valor: str) -> str:
        valor = valor.strip()
        if not valor:
            raise ValueError("El texto no puede estar vacio.")
        if len(valor) > 120:
            raise ValueError("El texto excede la longitud permitida.")
        return valor

    @field_validator("precio_unitario_mxn")
    @classmethod
    def validar_precio(cls, valor: Decimal) -> Decimal:
        if valor <= 0 or valor > PRECIO_MAXIMO:
            raise ValueError("El precio unitario esta fuera del rango permitido.")
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
        if valor <= 0 or valor > TOTAL_MAXIMO:
            raise ValueError("El total esta fuera del rango permitido.")
        return valor

    @model_validator(mode="after")
    def validar_coherencia(self, info: ValidationInfo) -> "VentaLeida":
        assert isinstance(self.fecha, date)
        hoy = (info.context or {}).get("hoy") or date.today()
        if self.fecha < date(2000, 1, 1):
            raise ValueError("La fecha es anterior al limite permitido.")
        if self.fecha > hoy + timedelta(days=1):
            raise ValueError("La fecha no puede ser futura.")
        if abs(self.total_mxn - (self.precio_unitario_mxn * self.cantidad)) > TOLERANCIA_TOTAL:
            raise ValueError("El total no coincide con precio unitario por cantidad.")
        if (self.importacion_id is None) != (self.id_origen is None):
            raise ValueError("La importacion y el identificador de origen deben estar ambos presentes o ambos ausentes.")
        if self.id_origen is not None and not (1 <= len(self.id_origen.strip()) <= 64):
            raise ValueError("El identificador de origen no es valido.")
        return self


class PaginaVentas(BaseModel):
    items: list[VentaLeida]
    total: int = Field(ge=0)
    limite: int = Field(ge=1)
    desplazamiento: int = Field(ge=0)
    registros_excluidos: int = Field(ge=0, default=0)

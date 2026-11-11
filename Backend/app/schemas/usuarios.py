from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class UsuarioLeido(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    nombre: str
    correo: EmailStr
    rol: Literal["cliente", "administrador"]
    activo: bool

    @field_validator("nombre")
    @classmethod
    def validar_nombre(cls, valor: str) -> str:
        valor = valor.strip()
        if not (1 <= len(valor) <= 120):
            raise ValueError("El nombre debe tener entre 1 y 120 caracteres.")
        return valor


class PaginaClientes(BaseModel):
    items: list[UsuarioLeido]
    total: int = Field(ge=0)
    limite: int = Field(ge=1)
    desplazamiento: int = Field(ge=0)

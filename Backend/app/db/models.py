import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Identity,
    Index,
    Numeric,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Usuario(Base):
    __tablename__ = "usuarios"
    __table_args__ = (
        CheckConstraint("length(trim(nombre)) BETWEEN 1 AND 120", name="nombre_valido"),
        CheckConstraint("correo = lower(correo)", name="correo_normalizado"),
        CheckConstraint("rol IN ('cliente', 'administrador')", name="rol_permitido"),
        CheckConstraint("password_hash LIKE '$argon2id$%'", name="hash_argon2id"),
        Index("ix_usuarios_rol", "rol"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    nombre: Mapped[str] = mapped_column(String(120), nullable=False)
    correo: Mapped[str] = mapped_column(String(254), nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    rol: Mapped[str] = mapped_column(String(20), nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default=text("true"))
    creado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
    actualizado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )

    __mapper_args__ = {"eager_defaults": True}


class Categoria(Base):
    __tablename__ = "categorias"
    __table_args__ = (
        CheckConstraint("length(trim(nombre)) BETWEEN 1 AND 60", name="nombre_valido"),
    )

    id: Mapped[int] = mapped_column(SmallInteger, Identity(), primary_key=True)
    nombre: Mapped[str] = mapped_column(String(60), nullable=False, unique=True)


class Producto(Base):
    __tablename__ = "productos"
    __table_args__ = (
        CheckConstraint("id ~ '^[A-Z]{1,3}[0-9]{3}$'", name="id_formato"),
        CheckConstraint("length(trim(nombre)) BETWEEN 1 AND 120", name="nombre_valido"),
        CheckConstraint("precio_actual_mxn > 0", name="precio_positivo"),
        Index("ix_productos_categoria_id", "categoria_id"),
    )

    id: Mapped[str] = mapped_column(String(20), primary_key=True)
    nombre: Mapped[str] = mapped_column(String(120), nullable=False)
    categoria_id: Mapped[int] = mapped_column(
        SmallInteger, ForeignKey("categorias.id", ondelete="RESTRICT"), nullable=False
    )
    precio_actual_mxn: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default=text("true"))
    creado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
    actualizado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )


class Importacion(Base):
    __tablename__ = "importaciones"
    __table_args__ = (
        CheckConstraint("length(trim(conjunto)) BETWEEN 1 AND 80", name="conjunto_valido"),
        CheckConstraint("hash_sha256 ~ '^[0-9a-f]{64}$'", name="hash_formato"),
        CheckConstraint("moneda = 'MXN'", name="moneda_mxn"),
        CheckConstraint("periodo_inicio <= periodo_fin", name="periodo_coherente"),
        CheckConstraint("cantidad_registros > 0", name="cantidad_positiva"),
        UniqueConstraint("id", "propietario_id", name="uq_importaciones_id_propietario"),
        Index("ix_importaciones_propietario_id", "propietario_id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    conjunto: Mapped[str] = mapped_column(String(80), nullable=False, unique=True)
    archivo: Mapped[str] = mapped_column(String(255), nullable=False)
    hash_sha256: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    perfil_demanda: Mapped[str] = mapped_column(String(80), nullable=False)
    fuente: Mapped[str] = mapped_column(
        String(40), nullable=False, default="datos_simulados", server_default=text("'datos_simulados'")
    )
    es_demostracion: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=text("true")
    )
    moneda: Mapped[str] = mapped_column(String(3), nullable=False, default="MXN", server_default=text("'MXN'"))
    periodo_inicio: Mapped[date] = mapped_column(Date, nullable=False)
    periodo_fin: Mapped[date] = mapped_column(Date, nullable=False)
    cantidad_registros: Mapped[int] = mapped_column(nullable=False)
    propietario_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="RESTRICT"), nullable=False
    )
    importado_por: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True
    )
    importado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )


class Venta(Base):
    __tablename__ = "ventas"
    __table_args__ = (
        CheckConstraint("fecha >= DATE '2000-01-01'", name="fecha_minima"),
        CheckConstraint("cantidad BETWEEN 1 AND 10000", name="cantidad_rango"),
        CheckConstraint("precio_unitario_mxn > 0 AND precio_unitario_mxn <= 1000000", name="precio_rango"),
        CheckConstraint("total_mxn > 0 AND total_mxn <= 10000000", name="total_rango"),
        CheckConstraint("abs(total_mxn - precio_unitario_mxn * cantidad) <= 0.01", name="total_coherente"),
        CheckConstraint("(importacion_id IS NULL) = (id_origen IS NULL)", name="origen_importacion_completo"),
        CheckConstraint("id_origen IS NULL OR length(trim(id_origen)) BETWEEN 1 AND 64", name="id_origen_valido"),
        ForeignKeyConstraint(
            ["importacion_id", "propietario_id"],
            ["importaciones.id", "importaciones.propietario_id"],
            name="fk_ventas_importacion_propietario",
            ondelete="RESTRICT",
        ),
        Index("ix_ventas_propietario_fecha", "propietario_id", "fecha"),
        Index("ix_ventas_producto_fecha", "producto_id", "fecha"),
        Index("ix_ventas_fecha", "fecha"),
        Index("ix_ventas_importacion", "importacion_id"),
        Index(
            "uq_ventas_importacion_origen",
            "importacion_id",
            "id_origen",
            unique=True,
            postgresql_where=text("importacion_id IS NOT NULL"),
        ),
        Index(
            "uq_ventas_propietario_idempotencia",
            "propietario_id",
            "clave_idempotencia",
            unique=True,
            postgresql_where=text("clave_idempotencia IS NOT NULL"),
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    importacion_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    id_origen: Mapped[str | None] = mapped_column(String(64), nullable=True)
    propietario_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="RESTRICT"), nullable=False
    )
    fecha: Mapped[date] = mapped_column(Date, nullable=False)
    producto_id: Mapped[str] = mapped_column(
        String(20), ForeignKey("productos.id", ondelete="RESTRICT"), nullable=False
    )
    precio_unitario_mxn: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    cantidad: Mapped[int] = mapped_column(nullable=False)
    total_mxn: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    clave_idempotencia: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    creado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )

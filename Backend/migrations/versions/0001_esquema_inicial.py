"""Esquema inicial de usuarios, catalogo, importaciones y ventas."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001_esquema_inicial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "usuarios",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("nombre", sa.String(length=120), nullable=False),
        sa.Column("correo", sa.String(length=254), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("rol", sa.String(length=20), nullable=False),
        sa.Column("activo", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column(
            "creado_en",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "actualizado_en",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "length(trim(nombre)) BETWEEN 1 AND 120",
            name="nombre_valido",
        ),
        sa.CheckConstraint("correo = lower(correo)", name="correo_normalizado"),
        sa.CheckConstraint(
            "rol IN ('cliente', 'administrador')",
            name="rol_permitido",
        ),
        sa.CheckConstraint(
            "password_hash LIKE '$argon2id$%'",
            name="hash_argon2id",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_usuarios"),
        sa.UniqueConstraint("correo", name="uq_usuarios_correo"),
    )
    op.create_index("ix_usuarios_rol", "usuarios", ["rol"], unique=False)

    op.create_table(
        "categorias",
        sa.Column("id", sa.SmallInteger(), sa.Identity(), nullable=False),
        sa.Column("nombre", sa.String(length=60), nullable=False),
        sa.CheckConstraint(
            "length(trim(nombre)) BETWEEN 1 AND 60",
            name="nombre_valido",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_categorias"),
        sa.UniqueConstraint("nombre", name="uq_categorias_nombre"),
    )

    op.create_table(
        "productos",
        sa.Column("id", sa.String(length=20), nullable=False),
        sa.Column("nombre", sa.String(length=120), nullable=False),
        sa.Column("categoria_id", sa.SmallInteger(), nullable=False),
        sa.Column("precio_actual_mxn", sa.Numeric(12, 2), nullable=False),
        sa.Column("activo", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column(
            "creado_en",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "actualizado_en",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("id ~ '^[A-Z]{1,3}[0-9]{3}$'", name="id_formato"),
        sa.CheckConstraint(
            "length(trim(nombre)) BETWEEN 1 AND 120",
            name="nombre_valido",
        ),
        sa.CheckConstraint("precio_actual_mxn > 0", name="precio_positivo"),
        sa.ForeignKeyConstraint(
            ["categoria_id"],
            ["categorias.id"],
            name="fk_productos_categoria_id_categorias",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_productos"),
    )
    op.create_index("ix_productos_categoria_id", "productos", ["categoria_id"], unique=False)

    op.create_table(
        "importaciones",
        sa.Column("id", sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column("conjunto", sa.String(length=80), nullable=False),
        sa.Column("archivo", sa.String(length=255), nullable=False),
        sa.Column("hash_sha256", sa.String(length=64), nullable=False),
        sa.Column("perfil_demanda", sa.String(length=80), nullable=False),
        sa.Column(
            "fuente",
            sa.String(length=40),
            server_default=sa.text("'datos_simulados'"),
            nullable=False,
        ),
        sa.Column(
            "es_demostracion",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
        sa.Column(
            "moneda",
            sa.String(length=3),
            server_default=sa.text("'MXN'"),
            nullable=False,
        ),
        sa.Column("periodo_inicio", sa.Date(), nullable=False),
        sa.Column("periodo_fin", sa.Date(), nullable=False),
        sa.Column("cantidad_registros", sa.Integer(), nullable=False),
        sa.Column("propietario_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("importado_por", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "importado_en",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "length(trim(conjunto)) BETWEEN 1 AND 80",
            name="conjunto_valido",
        ),
        sa.CheckConstraint(
            "hash_sha256 ~ '^[0-9a-f]{64}$'",
            name="hash_formato",
        ),
        sa.CheckConstraint("moneda = 'MXN'", name="moneda_mxn"),
        sa.CheckConstraint(
            "periodo_inicio <= periodo_fin",
            name="periodo_coherente",
        ),
        sa.CheckConstraint(
            "cantidad_registros > 0",
            name="cantidad_positiva",
        ),
        sa.ForeignKeyConstraint(
            ["propietario_id"],
            ["usuarios.id"],
            name="fk_importaciones_propietario_id_usuarios",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["importado_por"],
            ["usuarios.id"],
            name="fk_importaciones_importado_por_usuarios",
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_importaciones"),
        sa.UniqueConstraint("conjunto", name="uq_importaciones_conjunto"),
        sa.UniqueConstraint("hash_sha256", name="uq_importaciones_hash_sha256"),
        sa.UniqueConstraint(
            "id",
            "propietario_id",
            name="uq_importaciones_id_propietario",
        ),
    )
    op.create_index(
        "ix_importaciones_propietario_id",
        "importaciones",
        ["propietario_id"],
        unique=False,
    )

    op.create_table(
        "ventas",
        sa.Column("id", sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column("importacion_id", sa.BigInteger(), nullable=True),
        sa.Column("id_origen", sa.String(length=64), nullable=True),
        sa.Column("propietario_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("fecha", sa.Date(), nullable=False),
        sa.Column("producto_id", sa.String(length=20), nullable=False),
        sa.Column("precio_unitario_mxn", sa.Numeric(12, 2), nullable=False),
        sa.Column("cantidad", sa.Integer(), nullable=False),
        sa.Column("total_mxn", sa.Numeric(14, 2), nullable=False),
        sa.Column("clave_idempotencia", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "creado_en",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("fecha >= DATE '2000-01-01'", name="fecha_minima"),
        sa.CheckConstraint(
            "cantidad BETWEEN 1 AND 10000",
            name="cantidad_rango",
        ),
        sa.CheckConstraint(
            "precio_unitario_mxn > 0 AND precio_unitario_mxn <= 1000000",
            name="precio_rango",
        ),
        sa.CheckConstraint(
            "total_mxn > 0 AND total_mxn <= 10000000",
            name="total_rango",
        ),
        sa.CheckConstraint(
            "abs(total_mxn - precio_unitario_mxn * cantidad) <= 0.01",
            name="total_coherente",
        ),
        sa.CheckConstraint(
            "(importacion_id IS NULL) = (id_origen IS NULL)",
            name="origen_importacion_completo",
        ),
        sa.CheckConstraint(
            "id_origen IS NULL OR length(trim(id_origen)) BETWEEN 1 AND 64",
            name="id_origen_valido",
        ),
        sa.ForeignKeyConstraint(
            ["importacion_id", "propietario_id"],
            ["importaciones.id", "importaciones.propietario_id"],
            name="fk_ventas_importacion_propietario",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["producto_id"],
            ["productos.id"],
            name="fk_ventas_producto_id_productos",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["propietario_id"],
            ["usuarios.id"],
            name="fk_ventas_propietario_id_usuarios",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_ventas"),
    )
    op.create_index("ix_ventas_fecha", "ventas", ["fecha"], unique=False)
    op.create_index(
        "ix_ventas_propietario_fecha",
        "ventas",
        ["propietario_id", "fecha"],
        unique=False,
    )
    op.create_index(
        "ix_ventas_producto_fecha",
        "ventas",
        ["producto_id", "fecha"],
        unique=False,
    )
    op.create_index("ix_ventas_importacion", "ventas", ["importacion_id"], unique=False)
    op.create_index(
        "uq_ventas_importacion_origen",
        "ventas",
        ["importacion_id", "id_origen"],
        unique=True,
        postgresql_where=sa.text("importacion_id IS NOT NULL"),
    )
    op.create_index(
        "uq_ventas_propietario_idempotencia",
        "ventas",
        ["propietario_id", "clave_idempotencia"],
        unique=True,
        postgresql_where=sa.text("clave_idempotencia IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_ventas_propietario_idempotencia", table_name="ventas")
    op.drop_index("uq_ventas_importacion_origen", table_name="ventas")
    op.drop_index("ix_ventas_importacion", table_name="ventas")
    op.drop_index("ix_ventas_producto_fecha", table_name="ventas")
    op.drop_index("ix_ventas_propietario_fecha", table_name="ventas")
    op.drop_index("ix_ventas_fecha", table_name="ventas")
    op.drop_table("ventas")
    op.drop_index("ix_importaciones_propietario_id", table_name="importaciones")
    op.drop_table("importaciones")
    op.drop_index("ix_productos_categoria_id", table_name="productos")
    op.drop_table("productos")
    op.drop_table("categorias")
    op.drop_index("ix_usuarios_rol", table_name="usuarios")
    op.drop_table("usuarios")

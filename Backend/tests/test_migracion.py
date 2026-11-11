from sqlalchemy import inspect, text


def test_migracion_crea_todas_las_tablas(engine):
    inspector = inspect(engine)
    tablas = set(inspector.get_table_names())

    assert {
        "usuarios",
        "categorias",
        "productos",
        "importaciones",
        "ventas",
        "alembic_version",
    } <= tablas


def test_migracion_crea_indices_y_restricciones_de_ventas(engine):
    inspector = inspect(engine)
    indices = {indice["name"] for indice in inspector.get_indexes("ventas")}
    checks = {check["name"] for check in inspector.get_check_constraints("ventas")}

    assert {
        "ix_ventas_propietario_fecha",
        "ix_ventas_producto_fecha",
        "uq_ventas_importacion_origen",
        "uq_ventas_propietario_idempotencia",
    } <= indices
    assert {
        "ck_ventas_total_coherente",
        "ck_ventas_cantidad_rango",
        "ck_ventas_origen_importacion_completo",
    } <= checks


def test_migracion_tiene_revision_actual(engine):
    with engine.connect() as conexion:
        revision = conexion.scalar(text("SELECT version_num FROM alembic_version"))
    assert revision == "0001_esquema_inicial"

import os
from pathlib import Path

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

BACKEND = Path(__file__).resolve().parents[1]
DEMO_DIR = BACKEND / "data" / "demo"
CLAVE_PRUEBA = "ClaveSegura12345"


@pytest.fixture(scope="session")
def database_url() -> str:
    url = os.environ.get("TEST_DATABASE_URL", "").strip()
    if not url:
        pytest.skip("Define TEST_DATABASE_URL con una base PostgreSQL desechable.")
    os.environ["DATABASE_URL"] = url
    from app.config import get_settings

    get_settings.cache_clear()
    return url


@pytest.fixture(scope="session")
def engine(database_url: str):
    from alembic import command
    from alembic.config import Config

    motor = create_engine(database_url, pool_pre_ping=True)
    with motor.begin() as conexion:
        conexion.execute(text("DROP SCHEMA IF EXISTS public CASCADE"))
        conexion.execute(text("CREATE SCHEMA public"))

    configuracion = Config(str(BACKEND / "alembic.ini"))
    configuracion.set_main_option("script_location", str(BACKEND / "migrations"))
    configuracion.set_main_option("sqlalchemy.url", database_url)
    command.upgrade(configuracion, "head")

    yield motor
    motor.dispose()


@pytest.fixture()
def session(engine):
    fabrica = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    with engine.begin() as conexion:
        conexion.execute(
            text(
                "TRUNCATE TABLE ventas, importaciones, productos, categorias, usuarios "
                "RESTART IDENTITY CASCADE"
            )
        )
    with fabrica() as sesion:
        yield sesion
        sesion.rollback()


@pytest.fixture(scope="session")
def archivos_demo():
    from app.servicios.importacion import cargar_directorio

    return cargar_directorio(DEMO_DIR)


@pytest.fixture()
def catalogo(session, archivos_demo):
    from app.servicios.importacion import sembrar_catalogo_demo

    sembrar_catalogo_demo(session, archivos_demo)
    session.commit()
    return archivos_demo


@pytest.fixture()
def admin(session):
    from app.servicios.usuarios import crear_administrador_inicial

    usuario = crear_administrador_inicial(
        session,
        nombre="Administrador de Prueba",
        correo="admin@example.com",
        password=CLAVE_PRUEBA,
    )
    session.commit()
    return usuario


@pytest.fixture()
def cliente(session):
    from app.servicios.usuarios import crear_cliente

    usuario = crear_cliente(
        session,
        nombre="Cliente de Prueba",
        correo="cliente@example.com",
        password=CLAVE_PRUEBA,
    )
    session.commit()
    return usuario

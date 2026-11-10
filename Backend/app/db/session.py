from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import get_settings


def crear_engine(url: str | None = None) -> Engine:
    return create_engine(
        url or get_settings().database_url,
        pool_pre_ping=True,
        future=True,
    )


def crear_fabrica_sesiones(engine: Engine | None = None) -> sessionmaker[Session]:
    return sessionmaker(
        bind=engine or crear_engine(),
        autoflush=False,
        expire_on_commit=False,
        future=True,
    )


@contextmanager
def sesion_db(engine: Engine | None = None) -> Iterator[Session]:
    fabrica = crear_fabrica_sesiones(engine)
    with fabrica() as session:
        yield session

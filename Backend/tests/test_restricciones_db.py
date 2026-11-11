from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy.exc import IntegrityError

from app.db.models import Importacion, Usuario, Venta
from app.seguridad.passwords import hash_password
from app.servicios.usuarios import crear_cliente
from tests.conftest import CLAVE_PRUEBA


def _venta(cliente, **cambios) -> Venta:
    datos = {
        "propietario_id": cliente.id,
        "fecha": date(2026, 1, 5),
        "producto_id": "B003",
        "precio_unitario_mxn": Decimal("31.00"),
        "cantidad": 4,
        "total_mxn": Decimal("124.00"),
    }
    datos.update(cambios)
    return Venta(**datos)


def test_db_rechaza_venta_con_total_incoherente(session, catalogo, cliente):
    session.add(_venta(cliente, total_mxn=Decimal("100.00")))

    with pytest.raises(IntegrityError):
        session.flush()


def test_db_rechaza_cantidad_fuera_de_rango(session, catalogo, cliente):
    session.add(
        _venta(
            cliente,
            cantidad=10001,
            total_mxn=Decimal("310031.00"),
        )
    )

    with pytest.raises(IntegrityError):
        session.flush()


def test_db_rechaza_rol_desconocido(session):
    correo = "rol.invalido@example.com"
    session.add(
        Usuario(
            nombre="Rol invalido",
            correo=correo,
            password_hash=hash_password(CLAVE_PRUEBA, correo=correo),
            rol="superadministrador",
        )
    )

    with pytest.raises(IntegrityError):
        session.flush()


def test_db_rechaza_hash_que_no_es_argon2id(session):
    session.add(
        Usuario(
            nombre="Hash invalido",
            correo="hash.invalido@example.com",
            password_hash="texto-plano",
            rol="cliente",
        )
    )

    with pytest.raises(IntegrityError):
        session.flush()


def test_db_rechaza_venta_ligada_a_importacion_de_otro_cliente(session, catalogo, cliente):
    otro = crear_cliente(
        session,
        nombre="Otro Cliente",
        correo="otro.cliente@example.com",
        password=CLAVE_PRUEBA,
    )
    session.commit()

    importacion = Importacion(
        conjunto="prueba_propietario",
        archivo="prueba.json",
        hash_sha256="a" * 64,
        perfil_demanda="prueba",
        fuente="datos_simulados",
        es_demostracion=True,
        moneda="MXN",
        periodo_inicio=date(2026, 1, 1),
        periodo_fin=date(2026, 1, 31),
        cantidad_registros=1,
        propietario_id=cliente.id,
        importado_por=None,
    )
    session.add(importacion)
    session.flush()

    session.add(
        _venta(
            otro,
            importacion_id=importacion.id,
            id_origen="P-001",
        )
    )

    with pytest.raises(IntegrityError):
        session.flush()

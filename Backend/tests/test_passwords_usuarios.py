import pytest

from app.errores import (
    ConflictoUsuario,
    OperacionNoPermitida,
    PermisoDenegado,
)
from app.seguridad.passwords import (
    hash_password,
    necesita_rehash,
    validar_password,
    verificar_password,
)
from app.servicios.usuarios import (
    crear_administrador_inicial,
    crear_cliente,
    listar_clientes_admin,
    promover_cliente_admin,
)
from tests.conftest import CLAVE_PRUEBA


def test_hash_argon2id_y_verificacion():
    hash_guardado = hash_password(CLAVE_PRUEBA, correo="persona@example.com")

    assert hash_guardado.startswith("$argon2id$")
    assert CLAVE_PRUEBA not in hash_guardado
    assert verificar_password(hash_guardado, CLAVE_PRUEBA) is True
    assert verificar_password(hash_guardado, "OtraClave12345") is False
    assert necesita_rehash(hash_guardado) is False


@pytest.mark.parametrize(
    "password",
    [
        "corta1",
        "sinDigitos",
        "1234567890123",
        " ClaveSegura12345",
        "ClaveSegura12345 ",
    ],
)
def test_politica_de_contrasena_rechaza_valores_debiles(password):
    with pytest.raises(ValueError):
        validar_password(password)


def test_contrasena_no_puede_ser_igual_al_correo():
    with pytest.raises(ValueError):
        validar_password("correo1@example.com", correo="correo1@example.com")


def test_crear_cliente_siempre_asigna_rol_cliente(session):
    usuario = crear_cliente(
        session,
        nombre="  Persona Cliente  ",
        correo="Persona@Example.com",
        password=CLAVE_PRUEBA,
    )
    session.commit()

    assert usuario.rol == "cliente"
    assert usuario.correo == "persona@example.com"
    assert usuario.nombre == "Persona Cliente"
    assert usuario.activo is True


def test_correo_duplicado_es_rechazado(session):
    crear_cliente(
        session,
        nombre="Primera",
        correo="duplicado@example.com",
        password=CLAVE_PRUEBA,
    )
    with pytest.raises(ConflictoUsuario):
        crear_cliente(
            session,
            nombre="Segunda",
            correo="DUPLICADO@example.com",
            password=CLAVE_PRUEBA,
        )


def test_correo_invalido_es_rechazado(session):
    with pytest.raises(ValueError):
        crear_cliente(
            session,
            nombre="Persona",
            correo="no-es-correo",
            password=CLAVE_PRUEBA,
        )


def test_inicializacion_de_administrador_y_promocion(session):
    admin = crear_administrador_inicial(
        session,
        nombre="Administradora",
        correo="admin@example.com",
        password=CLAVE_PRUEBA,
    )
    session.commit()

    assert admin.rol == "administrador"
    with pytest.raises(OperacionNoPermitida):
        crear_administrador_inicial(
            session,
            nombre="Segundo Admin",
            correo="admin2@example.com",
            password=CLAVE_PRUEBA,
        )

    cliente = crear_cliente(
        session,
        nombre="Cliente Promovible",
        correo="promovible@example.com",
        password=CLAVE_PRUEBA,
    )
    session.commit()

    with pytest.raises(PermisoDenegado):
        promover_cliente_admin(session, actor_admin_id=cliente.id, cliente_id=cliente.id)

    with pytest.raises(PermisoDenegado):
        listar_clientes_admin(session, actor_admin_id=cliente.id)

    promovido = promover_cliente_admin(
        session,
        actor_admin_id=admin.id,
        cliente_id=cliente.id,
    )
    session.commit()
    assert promovido.rol == "administrador"

    pagina = listar_clientes_admin(session, actor_admin_id=promovido.id)
    assert pagina.total == 0


def test_admin_ve_solo_clientes_en_el_listado(session, admin):
    cliente = crear_cliente(
        session,
        nombre="Cliente Visible",
        correo="visible@example.com",
        password=CLAVE_PRUEBA,
    )
    session.commit()

    pagina = listar_clientes_admin(session, actor_admin_id=admin.id)
    assert pagina.total == 1
    assert [item.id for item in pagina.items] == [cliente.id]
    assert all(item.rol == "cliente" for item in pagina.items)

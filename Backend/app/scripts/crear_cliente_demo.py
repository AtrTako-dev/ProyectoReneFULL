import argparse
import sys

from app.db.session import sesion_db
from app.errores import ConflictoUsuario
from app.scripts.comun import obtener_password, obtener_texto
from app.servicios.usuarios import crear_cliente, obtener_usuario_por_correo


def main() -> int:
    parser = argparse.ArgumentParser(description="Crea la cuenta cliente de demostracion.")
    parser.add_argument("--correo", default=None)
    parser.add_argument("--nombre", default=None)
    args = parser.parse_args()

    correo = args.correo or obtener_texto(
        "DEMO_CLIENTE_CORREO", "Correo del cliente de demostracion: "
    )
    nombre = args.nombre or obtener_texto(
        "DEMO_CLIENTE_NOMBRE", "Nombre del cliente de demostracion: "
    )
    password = obtener_password(
        "DEMO_CLIENTE_PASSWORD", "Contrasena del cliente de demostracion: "
    )

    try:
        with sesion_db() as session:
            with session.begin():
                existente = obtener_usuario_por_correo(session, correo)
                if existente is not None:
                    print(f"El cliente ya existe: {existente.correo} ({existente.id})")
                    return 0
                usuario = crear_cliente(
                    session,
                    nombre=nombre,
                    correo=correo,
                    password=password,
                )
                print(f"Cliente creado: {usuario.correo} ({usuario.id})")
    except (ValueError, ConflictoUsuario) as exc:
        print(f"No se pudo crear el cliente: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

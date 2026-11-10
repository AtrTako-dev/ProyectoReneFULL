import argparse
import sys

from app.db.session import sesion_db
from app.errores import ConflictoUsuario, OperacionNoPermitida
from app.scripts.comun import obtener_password, obtener_texto
from app.servicios.usuarios import crear_administrador_inicial


def main() -> int:
    parser = argparse.ArgumentParser(description="Crea la cuenta administradora inicial.")
    parser.add_argument("--correo", default=None)
    parser.add_argument("--nombre", default=None)
    parser.add_argument(
        "--permitir-adicional",
        action="store_true",
        help="Permite crear otra cuenta administradora aunque ya exista una.",
    )
    args = parser.parse_args()

    correo = args.correo or obtener_texto("ADMIN_CORREO", "Correo del administrador: ")
    nombre = args.nombre or obtener_texto("ADMIN_NOMBRE", "Nombre del administrador: ")
    password = obtener_password("ADMIN_PASSWORD", "Contrasena del administrador: ")

    try:
        with sesion_db() as session:
            with session.begin():
                usuario = crear_administrador_inicial(
                    session,
                    nombre=nombre,
                    correo=correo,
                    password=password,
                    permitir_adicional=args.permitir_adicional,
                )
                print(f"Administrador creado: {usuario.correo} ({usuario.id})")
    except (ValueError, ConflictoUsuario, OperacionNoPermitida) as exc:
        print(f"No se pudo crear el administrador: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

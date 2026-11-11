import argparse
import os
import sys
from pathlib import Path

from app.db.session import sesion_db
from app.errores import ConflictoImportacion, ErrorValidacionArchivo, OperacionNoPermitida
from app.servicios.importacion import cargar_demo, obtener_importaciones
from app.servicios.usuarios import obtener_usuario_por_correo


def _directorio_por_defecto() -> Path:
    return Path(__file__).resolve().parents[2] / "data" / "demo"


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Carga los conjuntos simulados de demostracion en una transaccion."
    )
    parser.add_argument("--directorio", type=Path, default=None)
    parser.add_argument("--propietario-correo", default=None)
    parser.add_argument("--importado-por-correo", default=None)
    args = parser.parse_args()

    directorio = args.directorio or Path(
        os.getenv("DEMO_DIRECTORIO", str(_directorio_por_defecto()))
    )
    correo_propietario = args.propietario_correo or os.getenv("DEMO_CLIENTE_CORREO", "")
    correo_importador = args.importado_por_correo or os.getenv("ADMIN_CORREO", "")

    if not correo_propietario:
        print("Falta --propietario-correo o DEMO_CLIENTE_CORREO.", file=sys.stderr)
        return 1

    try:
        with sesion_db() as session:
            with session.begin():
                propietario = obtener_usuario_por_correo(session, correo_propietario)
                if propietario is None:
                    print(f"No existe el propietario {correo_propietario}.", file=sys.stderr)
                    return 1
                importador = None
                if correo_importador:
                    importador = obtener_usuario_por_correo(session, correo_importador)
                    if importador is None or importador.rol != "administrador":
                        print(
                            f"El importador {correo_importador} no existe o no es administrador.",
                            file=sys.stderr,
                        )
                        return 1
                resultados = cargar_demo(
                    session,
                    directorio,
                    propietario_id=propietario.id,
                    importado_por=importador.id if importador else None,
                )
                total_importaciones = len(obtener_importaciones(session))
            for resultado in resultados:
                print(
                    f"{resultado.archivo}: {resultado.estado}, "
                    f"ventas insertadas={resultado.ventas_insertadas}, "
                    f"ventas existentes={resultado.ventas_existentes}"
                )
            print(f"Importaciones registradas: {total_importaciones}")
    except ErrorValidacionArchivo as exc:
        print(f"Carga rechazada y revertida: {exc}", file=sys.stderr)
        for error in exc.errores:
            print(
                f"  archivo={error.archivo} fila={error.fila or '-'} "
                f"campo={error.campo}: {error.motivo}",
                file=sys.stderr,
            )
        return 1
    except ConflictoImportacion as exc:
        print(f"Carga rechazada: {exc}", file=sys.stderr)
        return 1
    except OperacionNoPermitida as exc:
        print(f"Carga no permitida: {exc}", file=sys.stderr)
        return 1
    except ValueError as exc:
        print(f"Carga rechazada: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

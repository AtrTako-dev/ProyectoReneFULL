import uuid

from email_validator import EmailNotValidError, validate_email
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import Usuario
from app.errores import ConflictoUsuario, NoEncontrado, OperacionNoPermitida, PermisoDenegado
from app.schemas.usuarios import PaginaClientes, UsuarioLeido
from app.seguridad.passwords import hash_password


def normalizar_correo(correo: str) -> str:
    try:
        resultado = validate_email(correo, check_deliverability=False)
    except EmailNotValidError as exc:
        raise ValueError("El correo no es valido.") from exc
    return resultado.normalized.lower()


def _normalizar_nombre(nombre: str) -> str:
    nombre = nombre.strip()
    if not (1 <= len(nombre) <= 120):
        raise ValueError("El nombre debe tener entre 1 y 120 caracteres.")
    return nombre


def _crear_usuario(
    session: Session,
    *,
    nombre: str,
    correo: str,
    password: str,
    rol: str,
) -> Usuario:
    nombre = _normalizar_nombre(nombre)
    correo = normalizar_correo(correo)
    if session.scalar(select(Usuario.id).where(Usuario.correo == correo)) is not None:
        raise ConflictoUsuario("El correo ya esta registrado.")
    password_hash = hash_password(password, correo=correo)
    usuario = Usuario(
        nombre=nombre,
        correo=correo,
        password_hash=password_hash,
        rol=rol,
        activo=True,
    )
    session.add(usuario)
    session.flush()
    return usuario


def crear_cliente(session: Session, *, nombre: str, correo: str, password: str) -> Usuario:
    return _crear_usuario(session, nombre=nombre, correo=correo, password=password, rol="cliente")


def crear_administrador_inicial(
    session: Session,
    *,
    nombre: str,
    correo: str,
    password: str,
    permitir_adicional: bool = False,
) -> Usuario:
    existe_administrador = session.scalar(
        select(Usuario.id).where(Usuario.rol == "administrador").limit(1)
    )
    if existe_administrador is not None and not permitir_adicional:
        raise OperacionNoPermitida("Ya existe una cuenta administradora.")
    return _crear_usuario(
        session,
        nombre=nombre,
        correo=correo,
        password=password,
        rol="administrador",
    )


def obtener_usuario_por_correo(session: Session, correo: str) -> Usuario | None:
    correo = normalizar_correo(correo)
    return session.scalar(select(Usuario).where(Usuario.correo == correo))


def verificar_actor_admin(session: Session, actor_id: uuid.UUID) -> Usuario:
    actor = session.get(Usuario, actor_id)
    if actor is None or not actor.activo or actor.rol != "administrador":
        raise PermisoDenegado("La operacion requiere una cuenta administradora activa.")
    return actor


def listar_clientes_admin(
    session: Session,
    *,
    actor_admin_id: uuid.UUID,
    limite: int = 100,
    desplazamiento: int = 0,
    solo_activos: bool = True,
) -> PaginaClientes:
    verificar_actor_admin(session, actor_admin_id)
    filtros = [Usuario.rol == "cliente"]
    if solo_activos:
        filtros.append(Usuario.activo.is_(True))
    total = session.scalar(select(func.count()).select_from(Usuario).where(*filtros)) or 0
    filas = session.scalars(
        select(Usuario)
        .where(*filtros)
        .order_by(Usuario.nombre.asc(), Usuario.id.asc())
        .offset(desplazamiento)
        .limit(limite)
    ).all()
    return PaginaClientes(
        items=[UsuarioLeido.model_validate(fila) for fila in filas],
        total=int(total),
        limite=limite,
        desplazamiento=desplazamiento,
    )


def promover_cliente_admin(
    session: Session,
    *,
    actor_admin_id: uuid.UUID,
    cliente_id: uuid.UUID,
) -> Usuario:
    verificar_actor_admin(session, actor_admin_id)
    cliente = session.get(Usuario, cliente_id)
    if cliente is None:
        raise NoEncontrado("El cliente solicitado no existe.")
    if cliente.rol == "administrador":
        return cliente
    if cliente.rol != "cliente":
        raise OperacionNoPermitida("El usuario no tiene un rol promovible.")
    if not cliente.activo:
        raise OperacionNoPermitida("No se puede promover una cuenta inactiva.")
    cliente.rol = "administrador"
    cliente.actualizado_en = func.now()
    session.flush()
    return cliente

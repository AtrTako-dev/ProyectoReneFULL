import re

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

MIN_LONGITUD = 12
MAX_LONGITUD = 128

_hasher = PasswordHasher(
    time_cost=3,
    memory_cost=65536,
    parallelism=4,
    hash_len=32,
    salt_len=16,
)

_TIENE_LETRA = re.compile(r"[A-Za-z]")
_TIENE_DIGITO = re.compile(r"[0-9]")


def validar_password(password: str, correo: str | None = None) -> None:
    if not isinstance(password, str):
        raise ValueError("La contrasena debe ser texto.")
    if len(password) < MIN_LONGITUD or len(password) > MAX_LONGITUD:
        raise ValueError(
            f"La contrasena debe tener entre {MIN_LONGITUD} y {MAX_LONGITUD} caracteres."
        )
    if password != password.strip():
        raise ValueError("La contrasena no debe comenzar ni terminar con espacios.")
    if not _TIENE_LETRA.search(password) or not _TIENE_DIGITO.search(password):
        raise ValueError("La contrasena debe incluir al menos una letra y un digito.")
    if correo is not None and password.lower() == correo.strip().lower():
        raise ValueError("La contrasena no puede ser igual al correo.")


def hash_password(password: str, correo: str | None = None) -> str:
    validar_password(password, correo)
    return _hasher.hash(password)


def verificar_password(hash_guardado: str, password: str) -> bool:
    try:
        return _hasher.verify(hash_guardado, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def necesita_rehash(hash_guardado: str) -> bool:
    try:
        return _hasher.check_needs_rehash(hash_guardado)
    except InvalidHashError:
        return True

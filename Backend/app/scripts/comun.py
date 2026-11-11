import getpass
import os


def obtener_texto(nombre_env: str, prompt: str) -> str:
    valor = os.getenv(nombre_env, "").strip()
    if valor:
        return valor
    return input(prompt).strip()


def obtener_password(nombre_env: str, prompt: str) -> str:
    valor = os.getenv(nombre_env, "")
    if valor:
        return valor
    return getpass.getpass(prompt)

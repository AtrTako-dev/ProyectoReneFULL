# Backend Proyecto ReneFULL

Base de datos, analitica y prediccion de demanda del backend. El alcance de esta
rama es exclusivamente `Backend/`: esquema PostgreSQL, migraciones Alembic,
carga de los cinco conjuntos simulados de demostracion, estadisticas y modelo
de demanda. Las rutas HTTP, la autenticacion y la app movil se integran en otras
ramas.

## Requisitos

- Python 3.12 o superior.
- PostgreSQL 15 o superior.
- Los cinco archivos JSON de `data/demo/` (datos simulados, no ventas reales).

## Instalacion

```powershell
cd Backend
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e ".[test]"
Copy-Item .env.example .env
```

Edite `.env` con una cadena de conexion real. No versione `.env` ni contrasenas.
La aplicacion usa SQLAlchemy 2, psycopg 3, Pydantic 2 y Argon2id.

## Base de datos

Cree una base vacia:

```sql
CREATE DATABASE proyectorenefull;
```

Aplique las migraciones:

```powershell
alembic upgrade head
```

Para revertir todo el esquema:

```powershell
alembic downgrade base
```

`DATABASE_URL` debe tener el formato
`postgresql+psycopg://usuario:password@host:5432/proyectorenefull`.

## Inicializacion de cuentas

La primera cuenta administradora se crea por un procedimiento controlado, nunca
desde el registro publico. El hash se genera con Argon2id y la contrasena se
solicita de forma interactiva o por variable de entorno temporal:

```powershell
python -m app.scripts.crear_admin
```

Tambien se puede usar `--correo`, `--nombre` y `ADMIN_PASSWORD`. No guarde la
contrasena en el repositorio. La opcion `--permitir-adicional` solo debe usarse
en una inicializacion controlada.

El registro publico siempre crea cuentas con rol `cliente`; no acepta roles
enviados por formularios, URLs ni clientes HTTP.

Cliente de demostracion (opcional):

```powershell
python -m app.scripts.crear_cliente_demo
```

## Carga de datos de demostracion

Los cinco JSON de `data/demo/` son datos simulados para la demostracion. No son
ventas reales y no deben sustituirse por datos inventados. La carga es
transaccional e idempotente: si un archivo ya se importo con el mismo contenido,
se informa `ya_importado`; si el conjunto o el hash cambian, se rechaza el
conflicto.

```powershell
$env:DEMO_CLIENTE_CORREO = "cliente.demo@example.com"
$env:ADMIN_CORREO = "admin@example.com"   # opcional, para registrar quien importa
python -m app.scripts.cargar_demo
```

Los archivos se validan fila por fila antes de escribir. Un archivo invalido
revierte la transaccion completa. Las filas invalidas que lleguen a existir en
la base se excluyen de listados, estadisticas y predicciones; una consulta
individual devuelve un error controlado.

## Pruebas

Las pruebas de integracion requieren una base PostgreSQL desechable. El fixture
elimina y recrea el esquema `public` de esa base y aplica todas las migraciones.
Nunca apunte `TEST_DATABASE_URL` a una base con datos reales.

```powershell
$env:TEST_DATABASE_URL = "postgresql+psycopg://postgres:postgres@localhost:5432/proyectorenefull_test"
pytest
```

Pruebas cubiertas:

- migracion completa y restricciones del esquema;
- validacion estructural de JSON, rechazo transaccional e idempotencia;
- aislamiento por propietario y errores controlados para filas invalidas;
- estadisticas de cliente y administrador calculadas desde PostgreSQL;
- corte cronologico del modelo, historial insuficiente, comparacion contra la
  linea base y prediccion determinista.

## Estructura

```text
Backend/
  app/
    db/            modelos y sesion SQLAlchemy
    ml/            modelo Ridge de demanda semanal
    repositorios/  consultas con alcance por propietario
    schemas/       contratos Pydantic de lectura
    scripts/       inicializacion y carga de demostracion
    seguridad/     Argon2id y politica de contrasenas
    servicios/     importacion, usuarios y analitica
  data/demo/       cinco conjuntos simulados
  docs/            contrato de base de datos y ML
  migrations/      migraciones Alembic
  tests/           pruebas de integracion y de modelo
```

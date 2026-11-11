# Backend Proyecto ReneFULL

El directorio contiene dos implementaciones independientes que comparten los datos simulados de `data/demo/`:

- **Node.js + Express + MySQL**, en `src/`: API REST de autenticación, ventas, estadísticas y predicción.
- **Python + PostgreSQL**, en `app/`: esquema, migraciones, importación de ventas, analítica y modelo de demanda.

Cada implementación tiene dependencias y configuración propias. La primera usa MySQL y variables `DB_*`; la segunda usa PostgreSQL y `DATABASE_URL`.

## Node.js + MySQL

### Requisitos e instalación

- Node.js 20.12 o superior.
- MySQL 8.0 con la base `proyecto_renefull` creada.

Desde `Backend/`, instala las dependencias:

```bash
npm install
```

En Windows PowerShell, usa `npm.cmd` si la política de ejecución bloquea `npm.ps1`.

### Configuración

Copia `.env.example` a `.env` y ajusta las variables `DB_*`. El archivo `.env` está excluido de Git. `JWT_SECRETO` debe ser una cadena aleatoria larga.

La cuenta administradora inicial se crea con:

```bash
npm run admin:crear
```

Los archivos `data/demo/*.json` se cargan con `npm run demo:cargar` y se asocian a `DEMO_EMAIL`. La carga se rechaza si la cuenta ya tiene ventas, para evitar duplicados.

### Ejecución

```bash
npm start
npm run dev
npm test
```

La ruta `GET /api/salud` responde `{ "estado": "ok" }` cuando el servidor está activo. El contrato de endpoints está en [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md).

## Python + PostgreSQL

### Requisitos e instalación

- Python 3.12 o superior.
- PostgreSQL 16 o superior.

En PowerShell, desde `Backend/`, crea el entorno e instala las dependencias:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e ".[test]"
Copy-Item .env.example .env
```

Configura `DATABASE_URL` con una cadena PostgreSQL. Crea la base vacía y aplica las migraciones:

```sql
CREATE DATABASE proyectorenefull;
```

```powershell
alembic upgrade head
```

Para revertir el esquema, usa `alembic downgrade base`.

### Cuentas y carga de demostración

La primera cuenta administradora se crea de forma controlada:

```powershell
python -m app.scripts.crear_admin
```

También se puede crear una cuenta cliente de demostración con `python -m app.scripts.crear_cliente_demo`.

Los cinco JSON de `data/demo/` contienen datos simulados. La carga es transaccional e idempotente:

```powershell
$env:DEMO_CLIENTE_CORREO = "cliente.demo@example.com"
$env:ADMIN_CORREO = "admin@example.com"
python -m app.scripts.cargar_demo
```

### Pruebas

Las pruebas de integración requieren una base PostgreSQL desechable. El fixture elimina y recrea el esquema `public`; no apuntes `TEST_DATABASE_URL` a una base con datos reales.

```powershell
$env:TEST_DATABASE_URL = "postgresql+psycopg://postgres:postgres@localhost:5432/proyectorenefull_test"
pytest
```

La documentación de datos y procesos está en [`docs/README.md`](docs/README.md), con el [contrato del backend](docs/CONTRATO_BACKEND.md), el [modelo de datos](docs/MODELO_DATOS.md), los [procesos](docs/PROCESOS.md) y las [validaciones](docs/VALIDACIONES.md).

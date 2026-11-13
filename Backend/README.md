# Backend — Proyecto ReneFULL

API REST en **Node.js + Express + MySQL 8** para autenticación, ventas del
cliente, catálogo, importaciones de demostración, estadísticas y estimación de
demanda. La autorización se resuelve desde MySQL en cada petición y las
consultas de ejecución nunca leen los archivos JSON.

El contrato estable de endpoints, DTOs, validaciones y esquema está en
[`docs/API_CONTRACT.md`](docs/API_CONTRACT.md). El DDL ejecutable es
[`db/migraciones/001_esquema_inicial.sql`](db/migraciones/001_esquema_inicial.sql).

> Los cinco archivos de `data/demo/` son **datos simulados de demostración**.
> No son ventas reales y no deben usarse para decisiones de negocio.

## Requisitos

- Node.js 20.12 o superior.
- MySQL 8.0.16 o superior (probado con 8.0.46).
- Una cuenta MySQL con permisos para crear la base de desarrollo, crear tablas,
  insertar y consultar. Para `npm run test:integracion` la misma cuenta debe poder
  crear y eliminar bases temporales con prefijo `renefull_test_`.

## Instalación

Desde `Backend/`:

```bash
npm install
cp .env.example .env
```

Ajuste como mínimo `DB_*` y `JWT_SECRETO`. El archivo `.env` está excluido de
Git; no guarde contraseñas reales en el repositorio.

```dotenv
DB_HOST=127.0.0.1
DB_PUERTO=3306
DB_USUARIO=renefull_app
DB_CONTRASENA=
DB_NOMBRE=proyecto_renefull
DB_CONEXIONES=10

JWT_SECRETO=una-cadena-larga-y-aleatoria-de-al-menos-32-caracteres
JWT_HORAS=8

ADMIN_NOMBRE=Administrador
ADMIN_EMAIL=admin@example.com
ADMIN_CONTRASENA=

DEMO_EMAIL=cliente.demo@example.com
DEMO_NOMBRE=Cliente de Demostracion
DEMO_CONTRASENA=
DEMO_DIRECTORIO=
```

`JWT_SECRETO` es obligatorio para arrancar el servidor. Los scripts de
migración y de cuentas no necesitan un token.

## Base de datos

```bash
npm run db:migrar
```

La migración crea la base si no existe, aplica los archivos pendientes de
`db/migraciones/`, verifica tablas, columnas, tipos, `UNIQUE`, `CHECK` y claves
foráneas, y solo entonces registra el nombre y el SHA-256 en la tabla
`migraciones`. Las ya aplicadas se omiten si el hash coincide; el hash se compara
con finales de línea normalizados y acepta las variantes CRLF/LF/CR. Si una
migración aplicada cambió de contenido, el proceso aborta para no alterar un
esquema existente. La evidencia de las versiones de `001` está en
[`docs/HISTORIAL_MIGRACIONES.md`](docs/HISTORIAL_MIGRACIONES.md).

Tablas resultantes: `usuarios`, `categorias`, `productos`, `importaciones`,
`ventas` y `migraciones`.

## Cuentas iniciales

Cree primero la cuenta administradora:

```bash
npm run admin:crear
```

Cree la cuenta cliente que recibirá los datos simulados:

```bash
npm run demo:cuenta
```

Para pasar la contraseña sin dejarla en `.env`, defina `ADMIN_CONTRASENA` o
`DEMO_CONTRASENA` en el entorno del proceso. Las contraseñas se guardan con
**Argon2id** y nunca se imprimen.

## Carga de demostración

Con `DEMO_EMAIL` apuntando a un cliente activo y, opcionalmente, `ADMIN_EMAIL`
a un administrador activo:

```bash
npm run demo:cargar
```

- Valida todos los JSON del directorio antes de abrir la transacción. El paquete
  oficial de `data/demo/` tiene cinco archivos de 100 ventas; `DEMO_DIRECTORIO`
  admite cualquier directorio con al menos un JSON válido.
- Carga 500 ventas, 41 productos y 6 categorías en una sola transacción.
- Es idempotente: un segundo intento con el mismo contenido omite los conjuntos
  ya importados y no duplica ventas.
- No sobrescribe el catálogo: crea solo lo que falta; si un producto existente
  difiere en nombre, categoría, precio o está inactivo, falla y revierte.
- No reasigna un conjunto a otro propietario.
- Si dos cargas concurrentes chocan en un `UNIQUE`, reporta un conflicto y hace
  `ROLLBACK`.
- Si algo falla, hace `ROLLBACK` de catálogo, importaciones y ventas.
- Conserva `producto_id` y `id_venta` como texto y el precio histórico en
  `ventas.precio_unitario_mxn`.

## Servidor

```bash
npm start
# desarrollo con recarga
npm run dev
```

La API se publica por defecto en `http://localhost:3000`. El contrato completo
de rutas y respuestas está en [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md).

## Pruebas

Pruebas unitarias y HTTP con modelos simulados, sin base de datos:

```bash
npm test
```

Pruebas de integración con MySQL real. Usan una base temporal única con prefijo
`renefull_test_` que se crea y se elimina en cada ejecución:

```powershell
$env:DB_PUERTO='3306'
$env:DB_USUARIO='root'
$env:DB_CONTRASENA=''
# TEST_DB_NOMBRE se puede omitir; la prueba genera un nombre único.
npm run test:integracion
```

La prueba rechaza cualquier nombre sin el prefijo, aborta si la base ya existe y
solo elimina la base que creó el proceso actual. Nunca toca `proyecto_renefull`
ni una base compartida.

Las pruebas de integración cubren la migración y sus hashes, los tipos
`CHAR(36)`/`DECIMAL`, la FK compuesta, el rollback, la carga demo, el catálogo
inmutable, la idempotencia, el aislamiento por propietario, las estadísticas, el
modelo de demanda y los flujos HTTP reales.

## Estructura

```text
Backend/
├─ data/demo/                 Cinco conjuntos simulados (100 ventas cada uno)
├─ db/migraciones/            DDL MySQL versionado
├─ docs/                      Contrato, esquema, procesos y validaciones
├─ pruebas/                   Pruebas unitarias, HTTP e integración MySQL
├─ scripts/                   Migración, cuentas y carga demo
└─ src/
   ├─ config/                 Variables de entorno
   ├─ controladores/          Endpoints HTTP
   ├─ db/                     Pool, transacciones y migraciones
   ├─ middleware/            Autenticación y errores
   ├─ modelos/                Acceso a MySQL
   ├─ rutas/                  Rutas Express
   ├─ servicios/              Estadísticas, predicción e importación
   └─ validaciones/           Reglas de entrada y DTOs
```

Más detalle: [`docs/ESQUEMA_MYSQL.md`](docs/ESQUEMA_MYSQL.md),
[`docs/PROCESOS_MYSQL.md`](docs/PROCESOS_MYSQL.md),
[`docs/VALIDACIONES_MYSQL.md`](docs/VALIDACIONES_MYSQL.md),
[`docs/HISTORIAL_MIGRACIONES.md`](docs/HISTORIAL_MIGRACIONES.md) y
[`docs/ALINEACION_MIA.md`](docs/ALINEACION_MIA.md).

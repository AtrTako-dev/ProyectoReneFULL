# Backend — Proyecto ReneFULL

API REST en **Node.js + Express + MySQL 8** para autenticación, ventas del cliente, catálogo,
importaciones de demostración, estadísticas y estimación de demanda. La autorización se resuelve
desde la base de datos en cada petición.

El contrato estable de endpoints, DTOs, validaciones y esquema MySQL esperado está en
[`docs/API_CONTRACT.md`](docs/API_CONTRACT.md).

## Requisitos

- Node.js 20.12 o superior.
- MySQL 8.0.
- El esquema y la migración inicial están en `db/migraciones/001_esquema_inicial.sql`.

`npm run db:migrar` crea la base `DB_NOMBRE` si hace falta y aplica las migraciones pendientes de la capa de datos.

La migración define usuarios con IDs numéricos y ventas con `usuario_id`. El modelo de la API todavía
espera UUIDs y columnas distintas; consulta **Limitaciones conocidas** antes de conectar ambos módulos.

## Instalación

```bash
npm install
```

En Windows con PowerShell, usa `npm.cmd` si la política de ejecución bloquea `npm.ps1`.

## Configuración

Copia `.env.example` a `.env` y completa los valores. `.env` está ignorado por Git.

| Variable | Uso |
| --- | --- |
| `PUERTO` | Puerto HTTP de la API (por defecto `3000`). |
| `DB_HOST`, `DB_PUERTO`, `DB_USUARIO`, `DB_CONTRASENA`, `DB_NOMBRE` | Conexión a MySQL. |
| `DB_CONEXIONES` | Máximo de conexiones del pool de datos. |
| `JWT_SECRETO` | Firma HS256 de los tokens; cadena larga y aleatoria (obligatoria). |
| `JWT_HORAS` | Vigencia del token en horas (por defecto `8`). |
| `ADMIN_NOMBRE` | Nombre de la cuenta inicial (por defecto `Administrador`). |
| `ADMIN_EMAIL`, `ADMIN_CONTRASENA` | Cuenta inicial para `npm run admin:crear`. |
| `DEMO_EMAIL`, `DEMO_NOMBRE`, `DEMO_PASSWORD` | Cuenta cliente usada para cargar los datos de demostración. |
| `IMPORTADO_POR_EMAIL` | Administrador opcional que queda asociado a la importación. |
| `MIN_SEMANAS_ENTRENAMIENTO`, `MIN_SEMANAS_CON_UNIDADES`, `SEMANAS_EVALUACION`, `ALPHA_RIDGE` | Parámetros del modelo semanal. |
| `TEST_DB_NOMBRE` | Nombre de la base desechable para pruebas de integración. |

## Preparación de la base y la cuenta demo

Aplique el esquema MySQL antes de crear cuentas o importar ventas:

```bash
npm run db:migrar
npm run demo:cuenta
```

`demo:cuenta` requiere `DEMO_PASSWORD`; crea el cliente identificado por `DEMO_EMAIL` y `DEMO_NOMBRE`.
Después, `npm run demo:cargar` importa el catálogo y las ventas simuladas a esa cuenta.

## Primer administrador

El registro público siempre crea clientes. La primera cuenta administradora se crea con:

```bash
npm run admin:crear
```

El comando lee `ADMIN_NOMBRE`, `ADMIN_EMAIL` y `ADMIN_CONTRASENA`, exige una contraseña de al menos
8 caracteres, genera el UUID en la aplicación, guarda el hash Argon2id y se niega a crear otra
cuenta si el correo ya existe.

## Datos de demostración

```bash
npm run demo:cargar
```

El comando valida los cinco archivos `Backend/data/demo/*.json`, y solo
después abre una transacción para:

1. Verificar que `DEMO_EMAIL` sea un cliente activo existente.
2. Verificar opcionalmente `ADMIN_EMAIL` como administrador que registra la importación.
3. Crear categorías y productos del catálogo.
4. Insertar una fila en `importaciones` por conjunto y sus ventas con `id_origen`.
5. Confirmar todo o revertir ante cualquier error.

La carga es idempotente: un conjunto ya importado con el **mismo hash** se omite; un conjunto con
contenido distinto, o el mismo hash con otro conjunto, se rechaza. Los JSON son datos simulados
(5 conjuntos × 100 ventas, 41 productos, periodo 2026-01-01..2026-06-30) y **no se consultan en
tiempo de ejecución**: la API lee únicamente MySQL.

No existe un endpoint público de carga.

## Ejecución

```bash
npm start      # servidor
npm run dev    # servidor con recarga automática
npm test                  # pruebas de API y unitarias; no requiere MySQL
npm run test:integracion  # pruebas de datos con MySQL desechable
```

La ruta `GET /api/salud` responde `{ "estado": "ok" }` cuando el proceso está arriba.

## Pruebas

`npm test` ejecuta las pruebas de API y unitarias con `node:test`, sin conectarse a MySQL.

`npm run test:integracion` requiere una instancia MySQL 8 y una instancia MySQL 8. `TEST_DB_NOMBRE` se usa como prefijo; la suite añade un sufijo único y borra
solo la base temporal que crea durante esa ejecución.

Las pruebas cubren:

- Validaciones de registro, login, ventas, fechas, paginación y roles.
- Formato de errores y traducción de errores de MySQL.
- Tokens HS256, Argon2id y middleware de permisos con rol vigente.
- Aislamiento entre propietarios y permisos directos a rutas administrativas.
- Serializadores, estadísticas semanales/mensuales y Ridge con línea base.
- Flujos HTTP con modelos simulados: registro/login, promoción, idempotencia y fallos de BD.
- Validación de los cinco conjuntos demo, incluidas metadata, ventas cerradas y catálogo coherente.
- Migraciones, carga transaccional, consultas de estadísticas y modelo de demanda (suite de integración).

## Estructura

```
src/
  app.js                 aplicación Express y montaje de rutas
  servidor.js            arranque y cierre ordenado del pool
  config/entorno.js      lectura de variables de entorno
  db/                    pool de MySQL y migraciones
  datos/                 validación, importación y consultas para el modelo de demanda
  middleware/            autenticación, rol vigente en BD y errores
  validaciones/          validación manual de cuerpos y query strings
  modelos/               usuarios, categorías, productos, importaciones y ventas
  servicios/             contraseñas, tokens, registros, estadísticas, predicción e importación demo
  controladores/         lógica de cada endpoint
  rutas/                 definición de rutas por área
scripts/                 creación del administrador y carga de demostración
data/demo/               cinco conjuntos JSON simulados (no se leen en runtime)
pruebas/                 pruebas unitarias y de API sin base de datos
```

## Autorización

- El token solo identifica al usuario (`sub` UUID); no transporta el rol.
- En cada petición protegida el rol y `activo` se leen de MySQL, por lo que una promoción,
  degradación o desactivación aplica de inmediato.
- Sin sesión, token inválido o cuenta inactiva → 401. Con sesión pero sin permiso → 403.
- Las rutas de cliente derivan el propietario del token: no aceptan un identificador de usuario.
- Un administrador no puede modificar su propio rol.
- Las respuestas usan `correo` (columna canónica); la entrada de registro/login acepta `email`
  por compatibilidad con la app móvil.

## Limitaciones conocidas

- La migración de datos y los modelos SQL de la API no comparten el mismo esquema: la migración usa
  `usuarios.id` numérico y `ventas.usuario_id`; la API usa UUID en `usuarios.id` y consulta
  `ventas.propietario_id`, además de otras columnas de catálogo distintas. No conectes la API a esa
  migración hasta acordar un esquema único.
- El registro de la API exige `nombre`; el formulario móvil actual solo envía correo y contraseña,
  así que recibe 422 en `campos.nombre`.
- Las pantallas cliente usan `UnavailableClientRepository`; todavía no envían ventas ni consultan
  estadísticas del backend.

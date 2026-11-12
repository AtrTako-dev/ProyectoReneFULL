# Backend — Proyecto ReneFULL

API REST en **Node.js + Express + MySQL 8** para autenticación, ventas del cliente, catálogo,
importaciones de demostración, estadísticas y estimación de demanda. La autorización se resuelve
desde la base de datos en cada petición.

El contrato estable de endpoints, DTOs, validaciones y esquema MySQL esperado está en
[`docs/API_CONTRACT.md`](docs/API_CONTRACT.md).

## Requisitos

- Node.js 20.12 o superior.
- MySQL 8.0 con la base `proyecto_renefull` creada.
- Las tablas `usuarios`, `categorias`, `productos`, `importaciones` y `ventas` con las columnas y
  restricciones del §8 del contrato.

> **Esquema pendiente:** la rama de Ismael define el modelo en PostgreSQL 16+/SQLAlchemy/Alembic.
> El backend Node ya consulta la traducción MySQL descrita en el contrato, pero **este repositorio
> no incluye el DDL MySQL** y `proyecto_renefull` aún no tiene tablas. Hasta que se acuerde y
> aplique ese esquema no se pueden ejecutar `admin:crear`, `demo:cargar` ni pruebas de integración.

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
| `JWT_SECRETO` | Firma HS256 de los tokens; cadena larga y aleatoria (obligatoria). |
| `JWT_HORAS` | Vigencia del token en horas (por defecto `8`). |
| `ADMIN_NOMBRE` | Nombre de la cuenta inicial (por defecto `Administrador`). |
| `ADMIN_EMAIL`, `ADMIN_CONTRASENA` | Cuenta inicial para `npm run admin:crear`. |
| `DEMO_EMAIL` | Cuenta cliente activa que recibe las ventas de demostración. |
| `DEMO_DIRECTORIO` | Directorio alternativo de JSON demo (por defecto `Backend/data/demo`). |

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

El comando valida los cinco archivos `Backend/data/demo/*.json` (o `DEMO_DIRECTORIO`), y solo
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
npm test       # pruebas con node:test
```

La ruta `GET /api/salud` responde `{ "estado": "ok" }` cuando el proceso está arriba.

## Pruebas

`npm test` ejecuta la suite de `pruebas/` con `node:test`, sin base de datos. Estado actual:
**111 de 111 pruebas en verde**. Cubren:

- Validaciones de registro, login, ventas, fechas, paginación y roles.
- Formato de errores y traducción de errores de MySQL.
- Tokens HS256, Argon2id y middleware de permisos con rol vigente.
- Aislamiento entre propietarios y permisos directos a rutas administrativas.
- Serializadores, estadísticas semanales/mensuales y Ridge con línea base.
- Flujos HTTP con modelos simulados: registro/login, promoción, idempotencia y fallos de BD.
- Validación de los cinco conjuntos demo, incluidas metadata/ventas cerradas y catálogo coherente.

Las pruebas de integración reales siguen pendientes por la ausencia de tablas MySQL.

## Estructura

```
src/
  app.js                 aplicación Express y montaje de rutas
  servidor.js            arranque y cierre ordenado del pool
  config/entorno.js      lectura de variables de entorno
  db/conexion.js         pool de MySQL2
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

- No hay DDL MySQL en esta rama; el esquema oficial de Ismael es PostgreSQL/Alembic.
- Sin tablas no se ejecutan la carga demo, la creación del administrador ni la integración real.
- El registro exige `nombre`; el formulario móvil actual solo envía correo y contraseña. La app
  debe añadirlo o recibirá 422 en `campos.nombre`. Este repositorio no modifica `FrontEnd/`.

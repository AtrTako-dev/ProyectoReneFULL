# Backend — Proyecto ReneFULL

API REST en Node.js + Express sobre MySQL. Cubre autenticación, ventas del cliente,
estadísticas y estimación de demanda, con autorización resuelta desde la base de datos.

El contrato de endpoints, formatos de respuesta y decisiones de negocio está en
[`docs/API_CONTRACT.md`](docs/API_CONTRACT.md).

## Requisitos

- Node.js 20.12 o superior.
- MySQL 8.0 con la base `proyecto_renefull` creada.
- Tablas `usuarios`, `productos` y `ventas` según las columnas del §5 del contrato
  (el esquema definitivo lo define el área de base de datos).

## Instalación

```bash
npm install
```

En Windows con PowerShell, usa `npm.cmd` si la política de ejecución bloquea `npm.ps1`.

## Configuración

Copia `.env.example` a `.env` y completa los valores. El archivo `.env` está ignorado por Git.

| Variable | Uso |
| --- | --- |
| `PUERTO` | Puerto HTTP de la API (por defecto `3000`). |
| `DB_HOST`, `DB_PUERTO`, `DB_USUARIO`, `DB_CONTRASENA`, `DB_NOMBRE` | Conexión a MySQL. |
| `JWT_SECRETO` | Firma de los tokens de sesión; cadena larga y aleatoria. |
| `JWT_HORAS` | Vigencia del token en horas (por defecto `8`). |
| `ADMIN_EMAIL`, `ADMIN_CONTRASENA` | Cuenta inicial para `npm run admin:crear`. |
| `DEMO_EMAIL` | Cuenta cliente que recibe las ventas de demostración. |

## Primer administrador

El registro público siempre crea clientes. La primera cuenta administradora se crea con:

```bash
npm run admin:crear
```

El comando lee `ADMIN_EMAIL` y `ADMIN_CONTRASENA`, exige una contraseña de al menos 8 caracteres,
guarda el hash Argon2id y se niega a crear otra cuenta si el correo ya existe.

## Datos de demostración

`npm run demo:cargar` importa los archivos `Backend/data/demo/*.json` a la base de datos,
asociados a la cuenta indicada en `DEMO_EMAIL`. Los registros inválidos se omiten y la carga se
rechaza si esa cuenta ya tiene ventas, para evitar duplicados. No existe un endpoint público de
carga: en tiempo de ejecución la API consulta únicamente la base de datos.

## Ejecución

```bash
npm start      # servidor
npm run dev    # servidor con recarga automática
npm test       # pruebas con node:test
```

La ruta `GET /api/salud` responde `{ "estado": "ok" }` cuando el proceso está arriba.

## Estructura

```
src/
  app.js                 aplicación Express y montaje de rutas
  servidor.js            arranque y cierre ordenado del pool
  config/entorno.js      lectura de variables de entorno
  db/conexion.js         pool de MySQL2
  middleware/            autenticación, rol vigente en BD y errores
  validaciones/          validación manual de cuerpos y query strings
  modelos/               consultas a usuarios, productos y ventas
  servicios/             contraseñas, tokens, registros, estadísticas, predicción
  controladores/         lógica de cada endpoint
  rutas/                 definición de rutas por área
scripts/                 creación del administrador y carga de demostración
pruebas/                 pruebas unitarias y de API sin base de datos
```

## Autorización

- El token solo identifica al usuario (`sub`); no transporta el rol.
- En cada petición protegida el rol se lee de la base de datos, por lo que una promoción o
  degradación aplica de inmediato.
- Sin sesión → 401. Con sesión pero sin permiso → 403.
- Las rutas de cliente derivan el propietario del token: no aceptan un identificador de usuario.
- Un administrador no puede modificar su propio rol.

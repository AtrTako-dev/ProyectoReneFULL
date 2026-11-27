# More Stock API

API REST de inventario, ventas y pronósticos para More Stock. Está construida con Node.js, Express y MySQL/TiDB; el modelo organiza su lógica mediante servicios y repositorios.

## Requisitos

- Node.js 22 o posterior.
- MySQL local para iniciar la API.
- Los archivos de `pulsostock_matriz_soriana_22500_v3/` para cargar el conjunto sintético de demostración.

## Instalación y configuración local

Desde esta carpeta, instala las versiones fijadas en el lockfile y crea la configuración local a partir del ejemplo:

```sh
npm ci
cp .env.example .env
```

Edita `Backend/.env` en tu computadora con el host, usuario, contraseña y nombre de una base MySQL local ya creada. El archivo está excluido de Git y sus valores no deben pegarse en tickets, informes ni repositorios. Al iniciar, la API comprueba la conexión y crea o ajusta las tablas del esquema. Con `DEMO_MODE=false`, las ventas, los surtidos y las cuentas deben existir en MySQL antes de iniciar; la API no importa los CSV ni crea cuentas demo en ese modo.

Para importar el conjunto sintético en una demostración local, usa `NODE_ENV=development` y `DEMO_MODE=true` en `.env`. Configura las cuentas demo mediante `DEMO_ACCOUNTS_JSON`; cada cuenta necesita correo, contraseña y `businessId`.

Para la demostración escolar desplegada, el modo demo de producción requiere habilitar explícitamente `ALLOW_PRODUCTION_DEMO_MODE=true` junto con `DEMO_MODE=true`. Guarda las cuentas en un archivo secreto JSON y configura `DEMO_ACCOUNTS_FILE` con su ruta; en Render, los Secret Files están disponibles en `/etc/secrets/<nombre>`. No incluyas contraseñas en el repositorio ni en archivos normales del proyecto. En este modo, cada inicio importa de forma idempotente el catálogo, los surtidos, las ventas y el inventario sintéticos, y sincroniza las contraseñas y roles de las cuentas demo configuradas. Usa esta opción solo para una instancia de demostración: las credenciales de esas cuentas se restablecen desde el archivo secreto cuando el servicio reinicia.

Inicia la API con:

```sh
npm start
```

En desarrollo escucha en `127.0.0.1:3000`. La ruta `http://127.0.0.1:3000/api/v1/health` ejecuta `SELECT 1` y devuelve el estado de la API y de MySQL/TiDB. Si la base no responde, devuelve HTTP 503 sin exponer detalles de conexión.

## Pronóstico y entrenamiento

Al arrancar, el proceso carga las ventas desde MySQL y ejecuta `ForecastService.initialize()`. El servicio reutiliza el artefacto cuya huella coincide con los datos; si la entrada cambió, evalúa los métodos, escoge por MAE de validación y entrena el modelo de despliegue con el histórico completo. Las solicitudes HTTP consultan el modelo cargado y no lo entrenan.

Para reproducir la evaluación cronológica de los CSV sin MySQL, usa el comando y la tabla publicados en [`docs/FASE_5_INFORME.md`](../docs/FASE_5_INFORME.md). Esa ejecución crea el servicio sin repositorio de artefactos, así que no guarda un modelo en la base.

## Pruebas

Ejecuta las pruebas automáticas sin habilitar persistencia MySQL:

```sh
npm test -- --test-concurrency=1
```

Las pruebas de persistencia requieren `RUN_MYSQL_PERSISTENCE_TESTS=true`, host local, la base aislada `more_stock_codex_test` y una cuenta en `DEMO_ACCOUNTS_JSON` asociada al negocio `201`. Configura las credenciales en `.env` y ejecuta:

```sh
RUN_MYSQL_PERSISTENCE_TESTS=true DB_NAME=more_stock_codex_test npm test -- --test-concurrency=1
```

La suite usa esa base para verificar la persistencia y restaura los registros que modifica. Si las condiciones de seguridad no se cumplen, las pruebas MySQL se omiten. No apuntes la suite a una base de desarrollo o producción.

## Protección de inicio de sesión

Por defecto, el inicio de sesión permite cinco fallos consecutivos por combinación de correo e IP dentro de 15 minutos. Al alcanzar el límite responde `429 LOGIN_RATE_LIMITED` e incluye `Retry-After`; un inicio de sesión correcto restablece el contador. Los valores se ajustan con `LOGIN_RATE_LIMIT_MAX_ATTEMPTS`, `LOGIN_RATE_LIMIT_WINDOW_MS`, `LOGIN_RATE_LIMIT_BLOCK_MS`, `LOGIN_RATE_LIMIT_CLEANUP_INTERVAL_MS` y `LOGIN_RATE_LIMIT_MAX_TRACKED_KEYS`.

El estado vive en memoria, con un máximo de 10,000 combinaciones, y se limpia periódicamente. Se borra al reiniciar y no se comparte entre procesos. En Render solo se debe configurar `LOGIN_RATE_LIMIT_CLIENT_IP_HEADER=CF-Connecting-IP` cuando una entrada confiable sobrescriba ese encabezado y no exista una ruta de acceso que permita falsificarlo. El valor predeterminado queda vacío y no confía en `X-Forwarded-For`. Consulta la [guía de Express](https://expressjs.com/en/guide/behind-proxies/), la [guía de Render sobre la IP del cliente](https://render.com/articles/how-render-handles-ddos-attacks) y la [referencia de `CF-Connecting-IP` de Render](https://render.com/articles/host-pocketbase-on-render).

## Preparación de despliegue

`../render.yaml` describe un servicio de Node con despliegues automáticos apagados. No contiene secretos. En Render, abre **more-stock-api → Environment** y configura `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` y `DB_NAME` con los datos de conexión de TiDB Cloud; conserva `DB_SSL=true`. Crea la base antes de iniciar el servicio y usa un usuario limitado a esa base con permisos de lectura, escritura, `CREATE` y `ALTER` para el inicializador del esquema. Guarda esos valores solo en el panel de Render, nunca en Kotlin, JavaScript, `render.yaml`, Git ni el APK. La guía de clúster y TLS está en [`docs/PENDIENTES_DESPLIEGUE.md`](../docs/PENDIENTES_DESPLIEGUE.md).

# More Stock API

API REST de More Stock con Express y MySQL/TiDB. La configuración local se carga desde `Backend/.env`; ese archivo se mantiene fuera del control de versiones.

## Inicio local

Instala las dependencias con `npm ci`, configura `Backend/.env` con los valores locales de MySQL y arranca la API con `npm start`. La aplicación escucha en `127.0.0.1` durante el desarrollo y publica la ruta de salud en `/api/v1/health`.

## Pruebas

Ejecuta `npm test` para las pruebas locales. Las pruebas de persistencia MySQL solo se habilitan de forma explícita con `RUN_MYSQL_PERSISTENCE_TESTS=true`, un servidor local (`localhost`, `127.0.0.1` o `::1`) y una base cuyo nombre termine en `_test`. Configura una base separada como `more_stock_test` antes de ejecutarlas; después puedes usar `RUN_MYSQL_PERSISTENCE_TESTS=true DB_NAME=more_stock_test npm test -- --test-concurrency=1`. Las ejecuciones simultáneas sobre la misma base de prueba se bloquean. No apuntes esas pruebas a una base de desarrollo o producción porque inicializan el esquema y los datos de demostración.

## Límite de intentos de inicio de sesión

El inicio de sesión permite cinco intentos fallidos por combinación de correo e IP dentro de una ventana de 15 minutos. Las solicitudes en curso también reservan un espacio para que una ráfaga simultánea no rebase el límite. Al alcanzarlo, la respuesta es `429 LOGIN_RATE_LIMITED` e incluye `Retry-After`; el bloqueo dura 15 minutos. Un inicio de sesión correcto restablece el contador. Los valores pueden ajustarse con `LOGIN_RATE_LIMIT_MAX_ATTEMPTS`, `LOGIN_RATE_LIMIT_WINDOW_MS`, `LOGIN_RATE_LIMIT_BLOCK_MS` y `LOGIN_RATE_LIMIT_CLEANUP_INTERVAL_MS`; están listados en `.env.example`.

En una conexión directa, la IP se obtiene de Express. El servicio de Render descrito en `render.yaml` debe configurar `LOGIN_RATE_LIMIT_CLIENT_IP_HEADER=CF-Connecting-IP` antes de desplegarlo y verificar que la entrada confiable sobrescriba el encabezado y que la aplicación no sea accesible por una ruta que permita falsificarlo. El valor predeterminado queda vacío y no confía en `X-Forwarded-For`, porque Express no puede asumir que un proxy lo saneó ([guía de Express](https://expressjs.com/en/guide/behind-proxies/); [guía de Render sobre IP del cliente](https://render.com/articles/how-render-handles-ddos-attacks); [guía de Render sobre `CF-Connecting-IP`](https://render.com/articles/host-pocketbase-on-render)).

El contador vive en memoria, guarda hasta 10,000 combinaciones activas, se limpia periódicamente y se borra al reiniciar el proceso. Cuando se llena, rechaza nuevas combinaciones con 429 hasta que expiren entradas; no elimina bloqueos vigentes para abrir espacio. El estado no se comparte entre varias instancias del backend, así que esta protección cubre una ejecución local o un proceso único y no reemplaza un limitador compartido en un despliegue con varias instancias.

## Despliegue preparado

El archivo `../render.yaml` define un servicio Node para Render con raíz `Backend/`, instalación reproducible desde `package-lock.json`, inicio con `npm start` y chequeo HTTP en `/api/v1/health`. El despliegue automático está apagado.

Para conectar TiDB Cloud, configura en el panel de Render `DB_HOST`, `DB_USER`, `DB_PASSWORD` y `DB_NAME` con los valores del clúster. La configuración del Blueprint usa el puerto MySQL/TiDB `4000`, activa TLS (`DB_SSL=true`) y desactiva la carga automática de datos demo (`DEMO_MODE=false`). Ajusta el puerto si el proveedor del clúster indica otro.

La inicialización de la base crea las tablas del esquema, pero el modo de producción no importa los CSV sintéticos ni crea cuentas demo. El usuario de base necesita permisos de lectura y escritura para la API, además de `CREATE` y `ALTER` porque el proceso prepara el esquema al arrancar. Los datos y cuentas para una demostración deben prepararse por separado antes de conectar la app.

## Límites antes de una publicación

- No hay valores de conexión ni contraseñas guardados en `render.yaml`.
- Se debe usar un usuario de base con permisos mínimos, no `root`.
- El endpoint de salud confirma que el proceso HTTP responde; no hace una consulta de disponibilidad a la base.
- No se ejecutó integración Backend–Android–DB y no se publicó el servicio.
- La cuenta de Render debe estar vinculada a un repositorio Git y a un clúster TiDB accesible antes de iniciar el Blueprint.

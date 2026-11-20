# PronoVenta

PronoVenta es una aplicación móvil escolar para registrar ventas y consultar estadísticas y estimaciones semanales de demanda. El repositorio contiene una API Node.js con MySQL y una app Android en Kotlin, Jetpack Compose y MVVM. El backend valida la identidad y los permisos en cada solicitud; la app presenta las funciones correspondientes a la sesión activa.

Los archivos de demostración contienen ventas simuladas para pruebas y configuración inicial. No representan ventas reales de una empresa.

## Requisitos

- Node.js 20.12 o superior y npm.
- MySQL 8.0.16 o superior, con soporte para el collation `utf8mb4_0900_ai_ci`.
- JDK 17.
- Android Studio con Android Gradle Plugin 9.4, Android SDK Platform 37 y Build-Tools 36.0.0.
- Un emulador Android o un dispositivo para ejecutar la app.

## Estructura

~~~text
Backend/
  app.js, server.js, API_CONTRACT.md
  config/       Conexión MySQL y variables de entorno
  controllers/  Controladores HTTP
  database/     Esquema, migraciones y datos iniciales
  middleware/   Autenticación y manejo de errores
  models/       Modelos de acceso a datos
  routes/       Rutas Express
  services/     Autenticación, estadísticas y predicción
  test/         Pruebas unitarias, HTTP e integración
  validaciones/ Reglas de entrada
  *.js          Migración, cuentas y utilidades de desarrollo
FrontEnd/       App Android Kotlin, Compose y MVVM
~~~

La arquitectura móvil está descrita en [FrontEnd/docs/ARQUITECTURA_Y_FLUJO.md](FrontEnd/docs/ARQUITECTURA_Y_FLUJO.md). El contrato de rutas, respuestas y validaciones está en [Backend/API_CONTRACT.md](Backend/API_CONTRACT.md).

## Configurar MySQL y el backend

Desde la raíz, crea la configuración local:

~~~sh
cp .env.example Backend/.env
~~~

Edita `Backend/.env` con los datos de MySQL. Configura `DB_HOST`, `DB_PUERTO`, `DB_USUARIO`, `DB_CONTRASENA`, `DB_NOMBRE` y `JWT_SECRETO`; el secreto JWT debe tener al menos 32 caracteres. Para crear las cuentas iniciales, define también `ADMIN_EMAIL`, `ADMIN_CONTRASENA`, `DEMO_EMAIL` y `DEMO_CONTRASENA`. Ese archivo está excluido de Git.

El usuario MySQL necesita permisos para crear y modificar el esquema, hacer consultas e insertar registros en la base del proyecto. La prueba de integración también necesita crear y eliminar bases cuyo nombre empieza con `renefull_test_`.

Desde una sesión administrativa de MySQL, puedes crear la cuenta local así; cambia la contraseña de muestra por una propia:

~~~sql
CREATE DATABASE proyecto_renefull
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER 'renefull_app'@'127.0.0.1' IDENTIFIED BY 'CAMBIA_ESTA_CONTRASENA';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, INDEX, REFERENCES
  ON proyecto_renefull.* TO 'renefull_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, INDEX, REFERENCES
  ON `renefull\_test\_%`.* TO 'renefull_app'@'127.0.0.1';
~~~

Instala dependencias y prepara la base desde `Backend/`:

~~~sh
cd Backend
npm ci
npm run db:diagnostico
npm run db:migrar
~~~

Para crear las cuentas y cargar el catálogo y los datos simulados:

~~~sh
npm run admin:crear
npm run demo:cuenta
npm run demo:cargar
~~~

La carga oficial lee los cinco JSON de `Backend/database/demo/`: 500 ventas simuladas, 41 productos y 6 categorías. La API consulta MySQL durante la ejecución; no lee esos JSON al responder solicitudes. Si se omiten las demos, hay que poblar el catálogo por otro medio para poder registrar ventas.

Inicia el servidor desde `Backend/`:

~~~sh
npm start
~~~

La API escucha por defecto en `http://localhost:3000`. No ejecutes `npm run db:reiniciar` contra una base compartida: el comando elimina la base configurada tras pedir confirmación explícita.

## Ejecutar la app Android

Abre `FrontEnd/` en Android Studio o compila desde una terminal:

~~~sh
cd FrontEnd
./gradlew test
./gradlew assembleDebug
~~~

Debug usa `http://10.0.2.2:3000` por defecto para conectar el emulador con la API local. Puedes cambiarla mediante una propiedad Gradle o una variable de entorno:

~~~sh
./gradlew -PAPI_BASE_URL=http://10.0.2.2:3000 assembleDebug
~~~

En un dispositivo físico, configura una URL que el dispositivo pueda alcanzar. Release bloquea HTTP sin cifrar y requiere una dirección HTTPS. Gradle recibe `API_BASE_URL` desde su propio proceso; la app no carga variables desde `Backend/.env`.

## Modelo de estimación

El backend estima las unidades vendidas por categoría para una semana mediante regresión Ridge con `alpha = 1.0` e intercepto. Sus cinco variables son el índice de semana, el mes, las unidades de la semana anterior, el promedio de las cuatro semanas previas y las unidades de cuatro semanas antes, una aproximación a la misma semana del mes anterior.

La evaluación reserva las cinco observaciones semanales más recientes y compara el error absoluto medio del modelo con una línea base que proyecta las unidades de la semana anterior. Solo devuelve una cifra si el modelo supera esa línea base. Si el historial no alcanza o el modelo no la supera, la API devuelve ese estado en lugar de inventar un número. Se requieren al menos 12 semanas completas, 8 semanas con unidades y suficientes observaciones para evaluación y entrenamiento; con los valores actuales hacen falta 14 semanas completas para obtener cinco observaciones de cada tipo. Toda cifra es una estimación, no una garantía.

## Pruebas

Desde `Backend/`, las pruebas unitarias y HTTP se ejecutan con:

~~~sh
npm test
~~~

Las pruebas de integración crean y eliminan únicamente una base temporal con prefijo `renefull_test_`:

~~~sh
npm run test:integracion
~~~

La prueba de humo requiere la API en ejecución. Crea dos cuentas y ventas de prueba que permanecen en la base de desarrollo:

~~~sh
npm run test:humo
~~~

Para la prueba de humo, `API_BASE_URL` puede configurarse en `Backend/.env`. `TEST_DB_NOMBRE` es opcional; si está vacío, la prueba de integración genera un nombre temporal único.

# PronoVenta

PronoVenta es una aplicación móvil escolar para registrar ventas y consultar estadísticas y estimaciones semanales de demanda. El repositorio contiene una API Node.js con MySQL y una app Android con Kotlin, Jetpack Compose y MVVM. El backend valida la identidad y los permisos en cada solicitud; la app solo presenta las funciones disponibles para la sesión activa.

Los archivos de demostración contienen ventas simuladas para pruebas y configuración inicial. No representan ventas reales de una empresa.

## Requisitos

- Node.js 20.12 o superior y npm.
- MySQL 8.0.16 o superior, con soporte para el collation `utf8mb4_0900_ai_ci`.
- JDK 17.
- Android Studio con Android Gradle Plugin 9.4, Android SDK Platform 37 y Build-Tools 36.0.0.
- Un emulador Android o un dispositivo para ejecutar la app.

## Estructura

~~~text
Backend/   API REST, configuración MySQL, migraciones, scripts y pruebas
FrontEnd/  App Android en Kotlin y Jetpack Compose, organizada con MVVM
~~~

El contrato de API está en [Backend/docs/API_CONTRACT.md](Backend/docs/API_CONTRACT.md). La arquitectura y el flujo de la app se describen en [FrontEnd/docs/ARQUITECTURA_Y_FLUJO.md](FrontEnd/docs/ARQUITECTURA_Y_FLUJO.md).

## Configurar MySQL y el backend

Desde la raíz, crea el archivo local de entorno:

~~~sh
cp .env.example Backend/.env
~~~

Edita `Backend/.env` con los datos de MySQL. Configura al menos `DB_HOST`, `DB_PUERTO`, `DB_USUARIO`, `DB_CONTRASENA`, `DB_NOMBRE` y `JWT_SECRETO`; el secreto JWT debe tener 32 caracteres o más. Para crear las cuentas iniciales, define también `ADMIN_EMAIL`, `ADMIN_CONTRASENA`, `DEMO_EMAIL` y `DEMO_CONTRASENA`. El archivo `.env` está excluido de Git y no debe contener datos reales en un commit.

El usuario MySQL necesita permisos para la base de desarrollo y para las bases temporales de integración. El SQL recomendado y sus alcances están en [Backend/docs/HISTORIAL_MIGRACIONES.md](Backend/docs/HISTORIAL_MIGRACIONES.md#6-permisos-mysql-para-desarrollo).

Instala las dependencias y comprueba el servidor MySQL desde `Backend/`:

~~~sh
cd Backend
npm ci
npm run db:diagnostico
npm run db:migrar
~~~

La migración crea o actualiza el esquema de la base configurada. Para preparar las cuentas iniciales y cargar los datos simulados:

~~~sh
npm run admin:crear
npm run demo:cuenta
npm run demo:cargar
~~~

La carga oficial importa desde `Backend/data/demo/` cinco conjuntos simulados con 500 ventas, 41 productos y 6 categorías. La API consulta MySQL durante la ejecución; no lee esos JSON para responder solicitudes.

Inicia la API desde `Backend/`:

~~~sh
npm start
~~~

Por defecto, la API escucha en `http://localhost:3000`. Las rutas, formatos de respuesta, validaciones y códigos de error están en el [contrato de API](Backend/docs/API_CONTRACT.md).

## Ejecutar la app Android

Abre `FrontEnd/` en Android Studio o compila desde una terminal:

~~~sh
cd FrontEnd
./gradlew test
./gradlew assembleDebug
~~~

La versión Debug usa `http://10.0.2.2:3000` por defecto para conectar el emulador con el servidor local. Puedes cambiar la URL mediante una propiedad Gradle o una variable de entorno:

~~~sh
./gradlew -PAPI_BASE_URL=http://10.0.2.2:3000 assembleDebug
~~~

En un dispositivo físico, configura una URL que el dispositivo pueda alcanzar. Las compilaciones Release bloquean el tráfico HTTP sin cifrar y requieren una URL HTTPS. Android Studio y Gradle reciben `API_BASE_URL` desde su propio proceso; la app no carga variables desde `Backend/.env`.

## Modelo de estimación

El backend estima las unidades vendidas por categoría para una semana. Usa regresión Ridge con `alpha = 1.0` e intercepto. Sus cinco variables son el índice de semana, el mes, las unidades de la semana anterior, el promedio de las cuatro semanas previas y las unidades de cuatro semanas antes (una aproximación a la misma semana del mes anterior).

La evaluación reserva las cinco observaciones semanales más recientes y compara el error absoluto medio del modelo con una línea base que proyecta las unidades de la semana anterior. Solo devuelve una cifra estimada si el modelo supera esa línea base. De lo contrario, la respuesta indica que no hay historial suficiente o que el modelo no supera la línea base; no se fabrica una predicción. El proceso requiere al menos 12 semanas completas, 8 semanas con unidades y observaciones suficientes para entrenar y evaluar; con la configuración actual se necesitan 14 semanas completas para obtener cinco observaciones de entrenamiento y cinco de evaluación. Toda cifra devuelta es una estimación, no una garantía.

## Pruebas

Desde `Backend/`, las pruebas unitarias y HTTP se ejecutan con:

~~~sh
npm test
~~~

Las pruebas de integración usan una base temporal cuyo nombre empieza con `renefull_test_`. El proceso crea y elimina únicamente la base temporal que genera; el usuario MySQL debe tener los permisos indicados arriba:

~~~sh
npm run test:integracion
~~~

La prueba de humo requiere la API en ejecución. Crea dos cuentas cliente y ventas de prueba que permanecen en la base de desarrollo:

~~~sh
npm run test:humo
~~~

Para esta prueba, `API_BASE_URL` en `Backend/.env` puede cambiar la dirección de la API. `TEST_DB_NOMBRE` es opcional; si se deja vacío, la prueba de integración genera un nombre temporal único.

## Archivos locales

`.env.example` contiene valores de configuración de muestra, sin credenciales reales. La configuración local se guarda en `Backend/.env`, que junto con archivos Gradle locales y productos de compilación está excluido por el `.gitignore` de la raíz. No ejecutes el script de reinicio de base de datos contra una base compartida.

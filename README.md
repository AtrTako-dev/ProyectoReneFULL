# Proyecto ReneFULL

Aplicación escolar para registrar ventas y consultar estadísticas y estimaciones de demanda. El repositorio incluye una API Node.js con MySQL y una app Android en Kotlin y Jetpack Compose.

## Requisitos

- Node.js 20.12 o superior y npm.
- MySQL 8.0.16 o superior.
- JDK 17 y Android SDK Platform 37.
- Android Studio actualizado para Android Gradle Plugin 9.4.

## Estructura

```text
Backend/   API REST, migraciones MySQL, scripts y pruebas
FrontEnd/  Aplicación Android con Kotlin, Compose y MVVM
```

La API está documentada en [`Backend/docs/API_CONTRACT.md`](Backend/docs/API_CONTRACT.md). La organización y los flujos de la app se describen en [`FrontEnd/docs/ARQUITECTURA_Y_FLUJO.md`](FrontEnd/docs/ARQUITECTURA_Y_FLUJO.md).

## Preparar MySQL y el backend

Desde la raíz del repositorio, copia el archivo de configuración de muestra y edita `Backend/.env` con los datos locales. No agregues ese archivo a Git.

```sh
cp .env.example Backend/.env
```

En `.env`, configura `DB_HOST`, `DB_PUERTO`, `DB_USUARIO`, `DB_CONTRASENA`, `DB_NOMBRE` y un `JWT_SECRETO` aleatorio de al menos 32 caracteres. Define también `ADMIN_EMAIL` y `ADMIN_CONTRASENA` antes de crear la cuenta administradora.

MySQL debe tener el collation `utf8mb4_0900_ai_ci`. Para crear una cuenta MySQL con permisos de desarrollo y pruebas, sigue el SQL de [`Backend/docs/HISTORIAL_MIGRACIONES.md`](Backend/docs/HISTORIAL_MIGRACIONES.md#6-permisos-mysql-para-desarrollo).

Instala dependencias y prepara la base desde `Backend/`:

```sh
cd Backend
npm install
npm run db:diagnostico
npm run db:migrar
```

El diagnóstico es de solo lectura. La migración crea o actualiza el esquema previsto. Para preparar cuentas y datos de demostración, configura `ADMIN_CONTRASENA` y `DEMO_CONTRASENA` en `Backend/.env` y ejecuta:

```sh
npm run admin:crear
npm run demo:cuenta
npm run demo:cargar
```

Inicia la API con:

```sh
npm start
```

La API escucha por defecto en `http://localhost:3000`. Las instrucciones de migración y pruebas están en [`Backend/README.md`](Backend/README.md).

## Ejecutar la app Android

Abre `FrontEnd/` en Android Studio o usa la terminal:

```sh
cd FrontEnd
./gradlew test
./gradlew assembleDebug
```

Para compilar Debug con el backend local desde un emulador Android:

```sh
./gradlew -PAPI_BASE_URL=http://10.0.2.2:3000 assembleDebug
```

Debug usa `http://10.0.2.2:3000` por defecto. Release desactiva el tráfico HTTP sin cifrar y requiere configurar una URL HTTPS mediante `API_BASE_URL`. La app no incluye un catálogo local; el formulario envía el ID y el precio del producto, y la API determina la categoría.

## Pruebas del backend

Desde `Backend/`:

```sh
npm test
npm run test:integracion
```

Las pruebas de integración crean y eliminan una base temporal con prefijo `renefull_test_`. La prueba de humo requiere la API en ejecución y crea una cuenta y una venta de prueba que permanecen en la base:

```sh
npm run test:humo
```

No ejecutes `npm run db:reiniciar` en una base compartida: elimina la base configurada después de solicitar confirmación explícita.

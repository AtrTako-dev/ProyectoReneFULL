# PronoVenta - Android

## Requisitos

- Android Studio actualizado para Android Gradle Plugin 9.4.
- JDK 17.
- Android SDK Platform 37 y Android SDK Build-Tools 36.0.0.
- Un emulador Android o un dispositivo con depuración USB habilitada.

## Abrir el proyecto

Abre esta carpeta (`FrontEnd/`) en Android Studio y espera a que termine la sincronización de Gradle. El proyecto incluye Gradle Wrapper; Android Studio descargará las dependencias declaradas en los archivos Gradle si todavía no están en caché.

Para compilar desde una terminal:

```sh
./gradlew assembleDebug
```

Para instalarlo en un emulador o dispositivo conectado:

```sh
./gradlew installDebug
```

La aplicación usa Kotlin, Jetpack Compose y MVVM. La estructura, los flujos de autenticación, ventas, estadísticas y administración, así como la comunicación HTTP con la API, se describen en [`docs/ARQUITECTURA_Y_FLUJO.md`](docs/ARQUITECTURA_Y_FLUJO.md).

## URL de la API

Configura `API_BASE_URL` como propiedad Gradle (`-PAPI_BASE_URL=https://...`) o variable de entorno. Debug usa `http://10.0.2.2:3000` si no se configura otra URL, lo que permite conectar un emulador Android a un backend local. Release desactiva HTTP sin cifrar y requiere una URL HTTPS.

Para ejecutar pruebas unitarias y compilar Debug:

```sh
./gradlew test
./gradlew assembleDebug
```

# More Stock para Android

Aplicación Android nativa construida con Kotlin, Jetpack Compose y MVVM. La interfaz consume la API REST del backend y no se conecta directamente a MySQL.

## Requisitos y apertura

Abre la carpeta `FrontEnd/` en Android Studio. El proyecto está configurado para JDK 17, `compileSdk` 37 y `minSdk` 26. Gradle descarga las versiones declaradas en el proyecto durante la primera sincronización.

## Dirección del backend

El valor predeterminado conecta el emulador Android con la API que se ejecuta en el equipo anfitrión en el puerto 3000:

```properties
morestock.apiBaseUrl=http://10.0.2.2:3000/api/v1
```

Para cambiarlo, define la propiedad en `FrontEnd/local.properties` o pásala a Gradle con `-Pmorestock.apiBaseUrl=...`. En un teléfono físico se usa la IP local de la computadora y ambos dispositivos deben compartir la red.

HTTP sin cifrar está habilitado solo en `debug`. La variante `release` requiere HTTPS. Antes de compilar una versión release, configura la URL real de la API con `morestock.apiBaseUrl`; los pasos de URL HTTPS y firma están en [`docs/PENDIENTES_DESPLIEGUE.md`](../docs/PENDIENTES_DESPLIEGUE.md).

## Ejecutar y compilar

Inicia primero el backend local y luego selecciona la configuración `app` en Android Studio para ejecutarla en un emulador o teléfono conectado.

Desde `FrontEnd/`, verifica las pruebas, lint y la compilación debug con:

```sh
./gradlew :app:testDebugUnitTest
./gradlew :app:lintDebug
./gradlew :app:assembleDebug
```

El APK debug se genera en `app/build/outputs/apk/debug/app-debug.apk`. La aplicación informa cuando el servidor tarda en responder y permite reintentar; los tiempos de conexión y lectura son 15 y 75 segundos.

## Funciones

- Inicio y cierre de sesión.
- Selección de negocios disponibles para la cuenta.
- Resumen, catálogo, inventario y recomendaciones con cantidad y explicación.
- Detalle del producto con pronóstico semanal separado de las semanas históricas.
- Etiqueta visible cuando el backend indica que el pronóstico o inventario usa datos sintéticos.

# Proyecto ReneFULL - Android

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

La aplicación base usa Kotlin, Jetpack Compose y MVVM como arquitectura prevista. Las pantallas y la conexión con el backend se agregarán sobre esta estructura.

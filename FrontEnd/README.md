# More Stock para Android

Aplicación Android nativa para consultar el inventario de un negocio, revisar recomendaciones y ver un pronóstico de demanda. Está construida con Kotlin, Jetpack Compose, Material 3 y MVVM. La app consume la API REST; no se conecta directamente a MySQL.

## Requisitos y apertura

Abre `FrontEnd/` en Android Studio. El código se compila con compatibilidad Java 17, `compileSdk` 37 y `minSdk` 26; el daemon de Gradle usa el JDK seleccionado en Android Studio. La primera sincronización descarga las versiones del catálogo de dependencias.

## Estructura del código

- `app/src/main/java/com/morestock/app/data/`: modelos, API y repositorio que adaptan las respuestas del servidor.
- `app/src/main/java/com/morestock/app/domain/validation/`: reglas compartidas para validar cantidades de inventario por unidad.
- `app/src/main/java/com/morestock/app/ui/viewmodel/`: estado de pantalla con `StateFlow` y acciones de login, selección, consulta, inventario y cierre de sesión.
- `app/src/main/java/com/morestock/app/ui/screens/`: pantallas Compose para acceso, negocios, cuenta, productos, inventario y detalle.
- `app/src/main/java/com/morestock/app/ui/view/components/`: tarjetas, campos, encabezados, indicadores y estados reutilizables.
- `app/src/main/java/com/morestock/app/ui/presentation/`: transformaciones simples para presentar listas y series de la gráfica.
- `app/src/main/java/com/morestock/app/ui/theme/`: paletas, tipografía, formas y espaciado de More Stock.

## Cómo agregar una pantalla

1. Define en el `ViewModel` el estado observable y las acciones que necesita la pantalla. Las llamadas a la API permanecen en `data` y las reglas de negocio fuera de los composables.
2. Crea el composable de pantalla con los datos que presenta y callbacks para cada acción del usuario. Mantén en la vista solo el estado temporal de interacción, como un filtro abierto o un diálogo.
3. Conecta la pantalla desde `MoreStockApp` o desde la navegación del negocio. Reutiliza componentes y colores de `ui/view/components` y `ui/theme`.
4. Marca encabezados, mensajes de error y controles con semántica accesible; muestra las unidades junto a las cantidades y no dependas solo del color.
5. Agrega previews con datos sintéticos identificados como demostración y pruebas JVM para nuevas reglas de presentación o comportamiento del `ViewModel`.

## Dirección del backend

El emulador Android usa la API del equipo anfitrión en `http://10.0.2.2:3000/api/v1`. Puedes cambiar la URL mediante `FrontEnd/local.properties` o `-Pmorestock.apiBaseUrl=...`.

HTTP sin cifrar está habilitado solo en `debug`; la variante `release` requiere HTTPS. Antes de compilar una versión release, configura la URL real de la API. Los pendientes de publicación están descritos en [`docs/PENDIENTES_DESPLIEGUE.md`](../docs/PENDIENTES_DESPLIEGUE.md).

## Ejecutar y verificar

Inicia primero el backend local. Desde `FrontEnd/`, ejecuta:

```sh
./gradlew :app:testDebugUnitTest
./gradlew :app:lintDebug
./gradlew :app:assembleDebug
```

El APK debug se genera en `app/build/outputs/apk/debug/app-debug.apk`. Para iniciar la app en un dispositivo conectado:

```sh
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.morestock.app/.MainActivity
```

La app muestra carga, error y mensajes para conexiones lentas. En el editor de inventario conserva la unidad del negocio, verifica el dato más reciente antes de guardar y mantiene el número escrito si detecta un cambio concurrente.

## Funciones

- Inicio y cierre de sesión con confirmación de salida.
- Selección de negocios y cuenta con negocio activo y rol.
- Resumen con productos de atención, catálogo con búsqueda/filtros y edición de inventario.
- Recomendación con explicación y cantidades de planificación entregadas por la API.
- Pronóstico con historial y estimación distinguidos en la gráfica.
- Avisos cuando el servidor indica que el inventario o el pronóstico usan datos sintéticos.

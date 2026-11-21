# More Stock — Informe de Fase 7

**Fecha:** 20 de noviembre de 2026  
**Alcance:** aplicación Android nativa Kotlin y Jetpack Compose, organizada con MVVM y conectada a la API REST de More Stock.

## Resultado

Se creó `FrontEnd/` como proyecto Android y se implementó un flujo de interfaz para iniciar sesión, elegir un negocio, consultar catálogo e inventario, revisar recomendaciones y ver el detalle de un producto con su pronóstico semanal.

La aplicación separa los modelos y las solicitudes HTTP (`data/`), el estado de pantalla (`ui/viewmodel/`) y la interfaz Compose (`ui/screens/`). La configuración predeterminada de API usa `http://10.0.2.2:3000/api/v1`, la dirección del equipo anfitrión desde el emulador Android. `FrontEnd/local.properties` permite cambiarla sin agregar configuración local al control de versiones.

Los datos sintéticos se identifican en las pantallas cuando la API los reporta. La aplicación no accede directamente a la base de datos.

## Funcionalidad implementada

- Inicio y cierre de sesión por `POST /auth/login` y `POST /auth/logout`.
- Selección de negocio desde la lista de membresías de la sesión.
- Consulta de catálogo, inventario y recomendaciones por negocio.
- Consulta de pronóstico por producto, con historial reciente, demanda semanal y métricas disponibles.
- Presentación de la recomendación, cantidad sugerida y explicación devuelta por el backend.
- Estados de carga y error, navegación de regreso y cancelación de solicitudes obsoletas del ViewModel.
- HTTP sin cifrar permitido únicamente en `debug` para el backend local; `release` exige HTTPS.

## Verificación y pendientes

La variante `debug` compiló correctamente con Gradle 9.6.0 y generó `FrontEnd/app/build/outputs/apk/debug/app-debug.apk`. No se ejecutaron pruebas automatizadas ni se conectó la app a un emulador. La fase 8 conserva la integración completa como actividad pendiente.

Antes de probar en un teléfono físico, hay que sustituir la dirección de emulador por la dirección IP local de la computadora en `FrontEnd/local.properties`. El backend debe estar activo y accesible desde ese dispositivo.

## Archivos principales

- `FrontEnd/app/src/main/java/com/morestock/app/MainActivity.kt`
- `FrontEnd/app/src/main/java/com/morestock/app/data/`
- `FrontEnd/app/src/main/java/com/morestock/app/ui/MoreStockApp.kt`
- `FrontEnd/app/src/main/java/com/morestock/app/ui/screens/`
- `FrontEnd/app/src/main/java/com/morestock/app/ui/viewmodel/`
- `FrontEnd/README.md`

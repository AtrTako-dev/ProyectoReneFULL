# More Stock para Android

Aplicación Android nativa construida con Kotlin, Jetpack Compose y MVVM. La interfaz consume la API REST del backend y no se conecta directamente a MySQL.

## Abrir el proyecto

Abre la carpeta `FrontEnd/` desde Android Studio. El proyecto requiere JDK 17 y Android SDK 37. Gradle sincroniza los plugins y bibliotecas declarados en los archivos del proyecto.

## Conectar con el backend local

El valor predeterminado apunta al backend que corre en el puerto 3000 del equipo anfitrión cuando se usa el emulador Android:

```properties
morestock.apiBaseUrl=http://10.0.2.2:3000/api/v1
```

Para cambiarlo, agrega esa propiedad a `FrontEnd/local.properties`. En un teléfono físico, usa la dirección IP local de la computadora y asegúrate de que ambos dispositivos estén en la misma red. La configuración HTTP sin cifrar solo está habilitada en la variante `debug`; la variante `release` requiere HTTPS.

Para una compilación `release`, configura la propiedad Gradle `morestock.apiBaseUrl` con la URL HTTPS real de la API. Se puede pasar con `-Pmorestock.apiBaseUrl` al ejecutar Gradle o definirla en `local.properties`, que está excluido del control de versiones. La dirección predeterminada del emulador es solo para desarrollo local.

## Flujo disponible

- Inicio y cierre de sesión mediante la API.
- Selección de negocio según las membresías devueltas por el backend.
- Resumen, catálogo, inventario y recomendaciones.
- Detalle por producto con pronóstico semanal, historial reciente, métricas y explicación de recomendación.
- Etiqueta visible cuando el backend identifica los datos como sintéticos.

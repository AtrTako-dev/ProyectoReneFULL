# Arquitectura y flujo de la aplicación móvil

## Stack y organización

La aplicación usa Kotlin, Jetpack Compose, Android Gradle Plugin 9.4.1, Kotlin Compose 2.2.10 y JDK 17. La estructura sigue MVVM:

```text
com.proyectorenefull.app/
  model/       Modelos de presentación e interfaces de repositorio
  data/        Cliente HTTP, repositorios y sesión local
  navigation/  Destinos y estado de navegación
  validation/  Validadores de formularios
  view/        Pantallas Compose, componentes y tema
  viewmodel/   Estado de pantallas y coordinación de casos de uso
```

Los ViewModels validan acciones y exponen estados observables. Los repositorios convierten las respuestas del servidor a modelos de la aplicación. Las vistas Compose muestran carga, éxito, vacío o error y envían acciones a los ViewModels.

## Flujo de autenticación y navegación

1. Al iniciar, la aplicación consulta `/api/auth/me` si existe una sesión local vigente.
2. El acceso y el registro usan `/api/auth/login` y `/api/auth/registro`. El registro envía únicamente nombre, correo y contraseña; el servidor asigna el rol de cliente.
3. El rol recibido en `usuario.rol` dirige a la pantalla de cliente o administrador.
4. La sesión guarda el token Bearer y su vencimiento de ocho horas. No hay renovación automática; al vencer, la app solicita volver a iniciar sesión.
5. Cerrar sesión elimina el token local. El servidor vuelve a verificar identidad, estado activo y rol en cada ruta protegida.

La navegación oculta funciones de otros roles para mantener una interfaz clara. El control de acceso efectivo pertenece al backend.

## Flujos de cliente

- El formulario de venta envía fecha, ID de producto, precio unitario, cantidad y una clave UUID de idempotencia a `POST /api/ventas`.
- La API determina el producto y su categoría desde el catálogo, valida el precio y deriva al propietario desde el token.
- Las ventas propias se consultan mediante `GET /api/ventas/mias`; la aplicación no envía un ID de propietario.
- Estadísticas y predicciones provienen de `GET /api/ventas/mias/estadisticas` y `GET /api/ventas/mias/predicciones`. Las predicciones se muestran como estimaciones y no se calculan en el dispositivo.

El contrato actual no expone una ruta para consultar el catálogo de productos. Por eso el formulario solicita el ID y el precio conocidos por la persona; el servidor rechaza productos inexistentes o precios que no correspondan.

## Flujos de administrador

- El panel consulta `GET /api/admin/estadisticas/ventas?agrupacion=semana`.
- La tabla y la gráfica se representan a partir de las mismas estadísticas por categoría de esa respuesta.
- La lista consulta `GET /api/admin/usuarios` y filtra las cuentas cuyo rol actual es cliente.
- Promover una cuenta muestra una confirmación y envía `PATCH /api/admin/usuarios/{id}/rol`. La app presenta el resultado devuelto por el servidor y actualiza la lista después de la respuesta exitosa.

Los rangos y la agrupación son compatibles con la API, pero esta versión conserva la vista semanal y no muestra filtros.

## Comunicación HTTP y errores

`ClienteApi` usa `HttpURLConnection`, ejecuta solicitudes fuera del hilo principal y entrega resultados mediante el `Handler` principal. Configura límites de conexión y lectura y adjunta `Authorization: Bearer` a rutas protegidas.

La app distingue errores de validación (400/422), sesión vencida o no válida (401), falta de permiso (403), recurso inexistente (404), conflicto (409), red/timeout y errores del servidor (5xx). Los mensajes de servidor no exponen trazas. Los reintentos de ventas conservan la misma clave de idempotencia mientras el formulario permanezca abierto y no cambien sus datos.

La URL se configura mediante la propiedad Gradle `API_BASE_URL` o la variable de entorno del mismo nombre. Debug usa `http://10.0.2.2:3000` si no se proporciona otra URL. El tráfico HTTP sin cifrar se permite solo en Debug; Release requiere una URL HTTPS accesible.

## Vista previa de desarrollo

Debug incluye una ruta de diseño para recorrer las pantallas de cliente y administrador. No crea sesiones ni datos, no llama a la API y no cambia permisos. Release no ofrece esa ruta.

## Verificación

Las pruebas unitarias cubren validadores, estados de ViewModels, respuestas de error controladas, cambios de rol y reintento idempotente de ventas. La comprobación manual con cuentas reales requiere una instancia accesible del backend y cuentas de cliente y administrador.

# Arquitectura y flujo de la aplicación móvil

Documento de planificación para el frontend de Proyecto ReneFULL.

## Estado actual

La aplicación tiene una `MainActivity` en Kotlin y el proyecto Gradle declara Android Gradle Plugin 9.4.1, Kotlin Compose 2.2.10, JDK 17 y Jetpack Compose. Jetpack Compose queda confirmado para el desarrollo de la interfaz. La navegación, las pantallas iniciales, los ViewModels y los validadores locales están implementados. Existen interfaces de repositorio para cliente; su implementación actual informa que el servicio no está disponible. No hay cliente HTTP ni formatos de respuesta de API porque el backend se integrará después.

La aplicación mantiene MVVM: los ViewModels gestionan navegación y estado/validación de formularios, y las vistas Compose representan ese estado. La pantalla de acceso contempla estados de envío y errores de autenticación, validación, red, conflicto y servidor. El enrutamiento recibe un rol interno de la sesión y dirige a cliente o administrador; su conversión desde la respuesta del servidor se hará al integrar el backend. Debug usa un repositorio local de demostración y Release no tiene autenticación conectada. La URL base y el contrato de la API no están documentados en `FrontEnd/`; se acordarán cuando el backend esté disponible.

## Flujo de pantallas propuesto

1. Al abrir la app, se muestra el acceso. Desde ahí se puede iniciar sesión o abrir el registro.
2. El registro solicita únicamente los datos de cliente definidos por el contrato; no presenta selección de rol.
3. Tras iniciar sesión, la respuesta vigente del servidor determina el destino: inicio de cliente o panel de administrador.
4. La navegación de cliente da acceso a inicio, registro de venta, ventas propias y estadísticas/predicciones.
5. La navegación de administrador da acceso al resumen estadístico y a la lista de clientes. La promoción de cliente muestra una confirmación antes de enviar la operación.
6. Cerrar sesión elimina la sesión local y vuelve al acceso.

La interfaz no solicita un identificador de cliente para consultar ventas o resultados propios. Ocultar opciones administrativas mejora la navegación, pero no sustituye el control de permisos del servidor.

## Pantallas y datos

| Área | Pantallas | Fuente de información |
| --- | --- | --- |
| Acceso | Inicio de sesión, registro | Respuestas de autenticación del servidor |
| Cliente | Inicio, registrar venta, ventas propias, estadísticas y predicciones | API con la sesión autenticada |
| Administrador | Resumen con tabla y gráfica, lista de clientes, confirmación de promoción | API administrativa |

La tabla y la gráfica administrativas se construirán desde la misma respuesta validada de estadísticas. Las predicciones mostrarán unidad, periodo y carácter estimado según los datos recibidos; la app no calculará predicciones ni inventará resultados.

## Organización MVVM propuesta

```text
com.proyectorenefull.app/
  core/                 Estado común, manejo de errores y configuración
  data/
    remote/             Cliente HTTP y DTO definidos por el contrato
    repository/         Implementaciones de acceso a datos
  domain/
    model/              Modelos usados por la aplicación
    repository/         Interfaces de repositorio
  navigation/           Rutas de pantalla y navegación Compose
  ui/
    auth/               Pantallas y ViewModels de acceso
    client/             Pantallas y ViewModels de cliente
    admin/              Pantallas y ViewModels de administrador
    components/         Componentes visuales compartidos
```

Los ViewModels mantienen el estado de cada pantalla y coordinan validación, repositorios y presentación de errores. Las vistas Compose representan ese estado y recogen acciones del usuario. Los DTO reflejarán exclusivamente los nombres y tipos acordados con la API; no se fijan aquí campos, rutas ni dependencias de red.

## Estados de interfaz

Cada consulta o modificación tendrá estados de carga, éxito, vacío y error. Los errores se presentarán según el contrato: 400/422 con el campo que debe corregirse, 401 solicitando autenticación vigente, 403 explicando la falta de permiso, 404 indicando indisponibilidad, 409 mostrando el conflicto, fallos de red/timeout con reintento seguro y 5xx con un mensaje general sin trazas.

El envío de ventas necesitará una estrategia de reintento que respete las garantías de idempotencia que ofrezca la API para evitar duplicados. La forma concreta se decidirá al revisar el contrato.

## Decisiones pendientes para integrar la API

Antes de crear servicios y modelos deben confirmarse con el responsable:

- Stack móvil aprobado y URL base de desarrollo.
- Mecanismo de autenticación, forma de conservar/renovar la sesión y respuesta que identifica el rol.
- Rutas, métodos, cuerpos y respuestas de registro e inicio de sesión.
- Catálogo de productos/categorías y límites de los campos de venta.
- Consulta de ventas propias, estadísticas y predicciones, incluidos filtros admitidos, unidades, periodos y formato de respuesta.
- Rutas y respuestas administrativas para estadísticas, clientes y promoción.
- Formato de errores de validación y comportamiento de reintentos para evitar ventas duplicadas.

El modo de vista previa disponible en Debug solo permite recorrer pantallas. No autentica cuentas, no contiene registros ficticios y no representa permisos efectivos. La vista Release no incluye el acceso de vista previa. Cuando se acuerde el contrato, los sustitutos de datos se limitarán a pruebas o a un entorno de desarrollo y quedarán fuera de la configuración de producción.

## Verificación prevista

Con el contrato confirmado, se añadirán pruebas de ViewModels y validadores para entradas válidas e inválidas, pruebas de estados de carga/vacío/éxito/error y pruebas controladas para 401, 403, 422 y conectividad. La compilación y las pruebas de frontend se ejecutarán con Gradle. La comprobación manual cubrirá una sesión de cliente y otra de administrador.

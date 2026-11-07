# Vista previa de desarrollo

La compilación Debug incluye un repositorio de autenticación local para recorrer el flujo de acceso y un acceso separado para revisar las pantallas de cliente y administrador. Sirve para revisar la navegación y el diseño mientras el backend aún no está disponible.

El acceso Debug no envía credenciales, no consulta un servidor y no crea cuentas reales. Un correo válido simula una sesión de cliente; `incorrecto@demo.test`, `sinred@demo.test`, `servidor@demo.test` y `sinpermiso@demo.test` muestran errores controlados. `duplicado@demo.test` simula un conflicto en el registro. La vista Release no incluye el repositorio local ni el acceso de exploración.

La vista previa no envía ventas, no carga ventas de ejemplo, no calcula predicciones y no cambia permisos. Los registros, estadísticas y clientes aparecen vacíos. La vista administrativa se explora desde un acceso de desarrollo separado y no representa una cuenta autorizada.

El formulario de venta valida campos obligatorios, precio positivo, cantidad entera positiva y fecha seleccionada. La categoría se escribe únicamente en Debug para revisar el diseño; en la integración real se elegirá del catálogo entregado por el servicio. Al pulsar «Revisar datos», la app informa que no envía ni guarda la venta.

Las pantallas de autenticación validan formato de correo y campos obligatorios. El contrato pendiente definirá los campos de registro, las reglas completas de contraseña, las rutas, la persistencia segura de la sesión y los formatos de respuesta antes de conectar estos formularios.

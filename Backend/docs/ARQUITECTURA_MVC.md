# Arquitectura del backend

La aplicación se compone mediante inyección de dependencias. `src/app.js`
exporta `crearApp({ baseDatos, servicioAuth })`, construye los modelos,
controladores y middleware, y monta las rutas. Las pruebas pueden inyectar
modelos controlados sin sustituir módulos ni abrir una conexión MySQL.

## Capas

- `src/db/conexion.js`: `BaseDatos` administra el pool, ejecuta consultas,
  coordina transacciones y cierra el pool. Las conexiones directas para tareas
  administrativas se abren con `abrirConexion` y se cierran por quien las usa.
- `src/db/migraciones.js`: `Migrador` recibe `BaseDatos` y aplica las
  migraciones conservando las verificaciones del esquema y los hashes
  registrados.
- `src/modelos/`: cada modelo recibe `BaseDatos` en su constructor y concentra
  las consultas de una entidad. Puede recibir una conexión transaccional en
  las operaciones que participan en una transacción.
- `src/servicios/`: `ServicioAuth` concentra el hash y la verificación de
  contraseñas y la creación y validación de tokens. `ServicioCargaDemo` recibe
  los modelos y `BaseDatos`; las funciones de validación, estadísticas y
  predicción permanecen como funciones sin estado.
- `src/controladores/`: las clases reciben los modelos y servicios que usan.
  Sus métodos flecha manejan las peticiones sin depender del contexto de una
  instancia global.
- `src/rutas/`: cada fábrica recibe el controlador y el middleware necesario,
  y devuelve un router Express.
- `src/middleware/auth.js`: el token solo aporta el UUID de identidad. En cada
  petición protegida se consulta el usuario vigente en MySQL y se verifican su
  estado y su rol.
- `src/servidor.js`: instancia las dependencias de producción, inicia Express
  y cierra el pool durante el apagado.

## Pruebas y scripts

Las pruebas HTTP crean la aplicación con `crearApp` e inyectan modelos por
instancia. Los scripts de migración, diagnóstico, cuentas y carga de datos
construyen sus propias dependencias para compartir las mismas clases que la
aplicación.

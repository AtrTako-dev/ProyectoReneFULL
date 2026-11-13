const app = require('./app');
const { configuracion, validarConfiguracionServidor } = require('./config/entorno');
const { cerrarPool } = require('./db/conexion');

validarConfiguracionServidor();

const servidor = app.listen(configuracion.puerto, () => {
  console.log(`API disponible en http://localhost:${configuracion.puerto}`);
});

async function cerrar(senal) {
  console.log(`Cerrando el servidor (${senal})...`);
  servidor.close(async () => {
    await cerrarPool();
    process.exit(0);
  });
}

process.on('SIGINT', () => cerrar('SIGINT'));
process.on('SIGTERM', () => cerrar('SIGTERM'));

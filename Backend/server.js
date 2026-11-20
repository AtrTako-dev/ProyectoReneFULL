const { crearApp } = require('./app');
const { configuracion, validarConfiguracionServidor } = require('./config/entorno');
const { BaseDatos } = require('./config/database');
const ServicioAuth = require('./services/servicioAuth');

validarConfiguracionServidor();

const baseDatos = new BaseDatos();
const app = crearApp({ baseDatos, servicioAuth: new ServicioAuth() });
const servidor = app.listen(configuracion.puerto, () => {
  console.log(`API disponible en http://localhost:${configuracion.puerto}`);
});

async function cerrar(senal) {
  console.log(`Cerrando el servidor (${senal})...`);
  servidor.close(async () => {
    await baseDatos.cerrar();
    process.exit(0);
  });
}

process.on('SIGINT', () => cerrar('SIGINT'));
process.on('SIGTERM', () => cerrar('SIGTERM'));

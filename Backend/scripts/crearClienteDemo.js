const { configuracion } = require('../src/config/entornoDatos');
const { crearClienteDemo } = require('../src/datos/cuentas');
const { aErrorPublico } = require('../src/datos/errores');
const { cerrarPool } = require('../src/db/mysql');

async function principal() {
  const resultado = await crearClienteDemo({
    email: configuracion.demo.email,
    nombre: configuracion.demo.nombre,
    password: configuracion.demo.password,
  });
  console.log(JSON.stringify({ estado: 'ok', ...resultado }, null, 2));
}

principal()
  .catch((error) => {
    console.error(JSON.stringify({ estado: 'error', ...aErrorPublico(error) }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await cerrarPool();
  });

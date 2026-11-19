const { BaseDatos } = require('../src/db/conexion');
const { Migrador } = require('../src/db/migraciones');

async function principal() {
  const migrador = new Migrador(new BaseDatos());
  const resultado = await migrador.aplicar({ crearBase: true });
  console.log(JSON.stringify({
    estado: 'ok', base: resultado.base,
    migraciones_aplicadas: resultado.aplicadas,
    migraciones_omitidas: resultado.omitidas,
  }, null, 2));
}

if (require.main === module) {
  principal().catch((error) => {
    console.error(`No fue posible aplicar las migraciones: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { principal };

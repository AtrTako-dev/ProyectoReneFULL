const { aplicarMigraciones } = require('../src/db/migraciones');

async function principal() {
  const resultado = await aplicarMigraciones({ crearBase: true });
  console.log(
    JSON.stringify(
      {
        estado: 'ok',
        base: resultado.base,
        migraciones_aplicadas: resultado.aplicadas,
        migraciones_omitidas: resultado.omitidas,
      },
      null,
      2
    )
  );
}

principal().catch((error) => {
  console.error(`No fue posible aplicar las migraciones: ${error.message}`);
  process.exitCode = 1;
});

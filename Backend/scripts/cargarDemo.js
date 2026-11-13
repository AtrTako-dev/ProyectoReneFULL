const { configuracion } = require('../src/config/entornoDatos');
const { cargarDemo } = require('../src/datos/importador');
const { aErrorPublico } = require('../src/datos/errores');
const { cerrarPool } = require('../src/db/mysql');

async function principal() {
  const resultado = await cargarDemo({
    emailDemo: configuracion.demo.email,
    importadoPorEmail: configuracion.importacion.importadoPorEmail,
  });
  console.log(JSON.stringify({ estado: 'ok', ...resultado }, null, 2));
}

principal()
  .catch((error) => {
    const publico = aErrorPublico(error);
    console.error(JSON.stringify({ estado: 'error', ...publico }, null, 2));
    if (publico.detalles && publico.detalles.errores) {
      for (const detalle of publico.detalles.errores.slice(0, 20)) {
        console.error(
          `- ${detalle.archivo || 'archivo'}#${detalle.fila || '-'} ${detalle.campo}: ${detalle.mensaje}`
        );
      }
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await cerrarPool();
  });

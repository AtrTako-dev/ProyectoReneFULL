const { BaseDatos } = require('./config/database');
const UsuarioModelo = require('./models/usuarioModelo');
const CategoriaModelo = require('./models/categoriaModelo');
const ImportacionModelo = require('./models/importacionModelo');
const { ServicioCargaDemo } = require('./services/cargaDemo');
const { ErrorImportacion } = require('./services/importacionDemo');

const baseDatos = new BaseDatos();
const cargaDemo = new ServicioCargaDemo({
  baseDatos,
  usuarioModelo: new UsuarioModelo(baseDatos),
  categoriaModelo: new CategoriaModelo(baseDatos),
  importacionModelo: new ImportacionModelo(baseDatos),
});

function imprimirDetalles(detalles) {
  for (const detalle of detalles) {
    const fila = detalle.fila === null || detalle.fila === undefined ? '-' : detalle.fila;
    console.error(
      `  archivo=${detalle.archivo} fila=${fila} campo=${detalle.campo}: ${detalle.motivo}`
    );
  }
}

function imprimirResumen(resumen) {
  for (const item of resumen.importados) {
    console.log(
      `${item.archivo}: importado, ventas insertadas=${item.ventas}, importacion=${item.importacion_id}`
    );
  }
  for (const item of resumen.omitidos) {
    console.log(
      `${item.archivo}: ya_importado, ventas existentes=${item.ventas}, importacion=${item.importacion_id}`
    );
  }
  console.log(
    `Carga terminada. Catálogo: ${resumen.catalogo.categorias} categorías, ` +
      `${resumen.catalogo.productos} productos. Ventas insertadas: ${resumen.ventas_insertadas}. ` +
      `Propietario: ${resumen.propietario.correo}.`
  );
}

async function principal(opciones = {}) {
  const resumen = await cargaDemo.cargar(opciones);
  imprimirResumen(resumen);
  return resumen;
}

if (require.main === module) {
  principal()
    .catch((error) => {
      console.error(`No se pudieron cargar los datos de demostración: ${error.message}`);
      if (error instanceof ErrorImportacion && error.detalles.length > 0) {
        imprimirDetalles(error.detalles);
      }
      process.exitCode = 1;
    })
    .finally(() => baseDatos.cerrar());
}

module.exports = { principal, imprimirDetalles, imprimirResumen };

const fs = require('node:fs');
const path = require('node:path');
const { configuracion } = require('../src/config/entorno');
const usuarioModelo = require('../src/modelos/usuarioModelo');
const ventaModelo = require('../src/modelos/ventaModelo');
const { validarRegistroVenta } = require('../src/servicios/registros');
const { redondear } = require('../src/validaciones/comunes');
const { cerrarPool } = require('../src/db/conexion');

const DIRECTORIO_DATOS = path.join(__dirname, '..', 'data', 'demo');

async function principal() {
  const email = (configuracion.demo.email || '').trim().toLowerCase();
  if (!email) {
    throw new Error('Configura DEMO_EMAIL en el archivo .env con una cuenta cliente existente.');
  }
  if (!fs.existsSync(DIRECTORIO_DATOS)) {
    throw new Error(
      `No existe el directorio ${DIRECTORIO_DATOS}. Los conjuntos de demostración deben estar en Backend/data/demo.`
    );
  }

  const usuario = await usuarioModelo.buscarPorEmail(email);
  if (!usuario) {
    throw new Error('La cuenta indicada en DEMO_EMAIL no existe. Regístrala antes de cargar los datos.');
  }

  const ventasExistentes = await usuarioModelo.contarVentas(usuario.id);
  if (ventasExistentes > 0) {
    throw new Error('La cuenta ya tiene ventas registradas; no se cargaron datos para evitar duplicados.');
  }

  const archivos = fs
    .readdirSync(DIRECTORIO_DATOS)
    .filter((archivo) => archivo.toLowerCase().endsWith('.json'))
    .sort();

  if (archivos.length === 0) {
    throw new Error('No hay archivos JSON en Backend/data/demo.');
  }

  let insertadas = 0;
  let omitidas = 0;

  for (const archivo of archivos) {
    const contenido = JSON.parse(fs.readFileSync(path.join(DIRECTORIO_DATOS, archivo), 'utf8'));
    const registros = Array.isArray(contenido) ? contenido : contenido.ventas;
    if (!Array.isArray(registros)) {
      throw new Error(`El archivo ${archivo} no contiene una lista de ventas.`);
    }

    for (const registro of registros) {
      const fila = { ...registro, usuario_id: usuario.id };
      const { valida } = validarRegistroVenta(fila);
      if (!valida) {
        omitidas += 1;
        continue;
      }

      await ventaModelo.insertar({
        usuarioId: usuario.id,
        fecha: fila.fecha,
        productoId: Number(fila.producto_id),
        producto: fila.producto,
        categoria: fila.categoria,
        precioUnitarioMxn: Number(fila.precio_unitario_mxn),
        cantidad: Number(fila.cantidad),
        totalMxn: redondear(Number(fila.precio_unitario_mxn) * Number(fila.cantidad)),
      });
      insertadas += 1;
    }

    console.log(`${archivo}: ${registros.length} registros revisados.`);
  }

  console.log(`Carga terminada: ${insertadas} ventas insertadas, ${omitidas} registros inválidos omitidos.`);
}

principal()
  .catch((error) => {
    console.error(`No se pudieron cargar los datos de demostración: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(cerrarPool);

const { obtenerPool } = require('../db/conexion');

async function buscarPorId(productoId) {
  const [filas] = await obtenerPool().execute(
    'SELECT producto_id, producto, categoria, precio_unitario_mxn FROM productos WHERE producto_id = ?',
    [productoId]
  );
  return filas[0] || null;
}

module.exports = { buscarPorId };

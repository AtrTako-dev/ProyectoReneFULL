const { obtenerPool } = require('../db/conexion');

const COLUMNAS =
  'id_venta, usuario_id, fecha, producto_id, producto, categoria, precio_unitario_mxn, cantidad, total_mxn';

function construirFiltroFechas({ desde, hasta } = {}) {
  const condiciones = [];
  const parametros = [];
  if (desde) {
    condiciones.push('fecha >= ?');
    parametros.push(desde);
  }
  if (hasta) {
    condiciones.push('fecha <= ?');
    parametros.push(hasta);
  }
  return { condiciones, parametros };
}

async function insertar({
  usuarioId,
  fecha,
  productoId,
  producto,
  categoria,
  precioUnitarioMxn,
  cantidad,
  totalMxn,
}) {
  const [resultado] = await obtenerPool().execute(
    `INSERT INTO ventas
       (usuario_id, fecha, producto_id, producto, categoria, precio_unitario_mxn, cantidad, total_mxn)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [usuarioId, fecha, productoId, producto, categoria, precioUnitarioMxn, cantidad, totalMxn]
  );
  return buscarPorId(resultado.insertId);
}

async function buscarPorId(idVenta) {
  const [filas] = await obtenerPool().execute(
    `SELECT ${COLUMNAS} FROM ventas WHERE id_venta = ?`,
    [idVenta]
  );
  return filas[0] || null;
}

async function listarPorUsuario(usuarioId, rango = {}) {
  const { condiciones, parametros } = construirFiltroFechas(rango);
  const filtro = condiciones.length ? ` AND ${condiciones.join(' AND ')}` : '';
  const [filas] = await obtenerPool().execute(
    `SELECT ${COLUMNAS} FROM ventas WHERE usuario_id = ?${filtro} ORDER BY fecha, id_venta`,
    [usuarioId, ...parametros]
  );
  return filas;
}

async function listarGlobal(rango = {}) {
  const { condiciones, parametros } = construirFiltroFechas(rango);
  const filtro = condiciones.length ? ` WHERE ${condiciones.join(' AND ')}` : '';
  const [filas] = await obtenerPool().execute(
    `SELECT ${COLUMNAS} FROM ventas${filtro} ORDER BY fecha, id_venta`,
    parametros
  );
  return filas;
}

module.exports = { insertar, buscarPorId, listarPorUsuario, listarGlobal };

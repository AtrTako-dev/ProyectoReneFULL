const conexion = require('../db/conexion');

const SELECCION = `SELECT v.id,
       v.importacion_id,
       v.id_origen,
       v.propietario_id,
       v.fecha,
       v.producto_id,
       p.nombre AS producto,
       c.nombre AS categoria,
       v.precio_unitario_mxn,
       v.cantidad,
       v.total_mxn,
       v.clave_idempotencia,
       COALESCE(i.es_demostracion, 0) AS es_demostracion
  FROM ventas v
  INNER JOIN productos p ON p.id = v.producto_id
  INNER JOIN categorias c ON c.id = p.categoria_id
  LEFT JOIN importaciones i ON i.id = v.importacion_id`;

function construirFiltroFechas(rango = {}) {
  const condiciones = [];
  const parametros = [];
  if (rango.desde) {
    condiciones.push('v.fecha >= ?');
    parametros.push(rango.desde);
  }
  if (rango.hasta) {
    condiciones.push('v.fecha <= ?');
    parametros.push(rango.hasta);
  }
  return { condiciones, parametros };
}

async function insertar(
  {
    propietarioId,
    fecha,
    productoId,
    precioUnitarioMxn,
    cantidad,
    totalMxn,
    importacionId = null,
    idOrigen = null,
    claveIdempotencia = null,
  },
  ejecutor = conexion.obtenerPool()
) {
  const [resultado] = await ejecutor.execute(
    `INSERT INTO ventas
       (importacion_id, id_origen, propietario_id, fecha, producto_id,
        precio_unitario_mxn, cantidad, total_mxn, clave_idempotencia)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      importacionId,
      idOrigen,
      propietarioId,
      fecha,
      productoId,
      precioUnitarioMxn,
      cantidad,
      totalMxn,
      claveIdempotencia,
    ]
  );
  return buscarPorId(resultado.insertId, ejecutor);
}

async function buscarPorId(idVenta, ejecutor = conexion.obtenerPool()) {
  const [filas] = await ejecutor.execute(`${SELECCION} WHERE v.id = ? LIMIT 1`, [idVenta]);
  return filas[0] || null;
}

async function buscarPorClaveIdempotencia(
  propietarioId,
  claveIdempotencia,
  ejecutor = conexion.obtenerPool()
) {
  const [filas] = await ejecutor.execute(
    `${SELECCION} WHERE v.propietario_id = ? AND v.clave_idempotencia = ? LIMIT 1`,
    [propietarioId, claveIdempotencia]
  );
  return filas[0] || null;
}

async function listarPorPropietario(
  propietarioId,
  rango = {},
  ejecutor = conexion.obtenerPool()
) {
  const { condiciones, parametros } = construirFiltroFechas(rango);
  const filtro = condiciones.length ? ` AND ${condiciones.join(' AND ')}` : '';
  const [filas] = await ejecutor.execute(
    `${SELECCION} WHERE v.propietario_id = ?${filtro} ORDER BY v.fecha ASC, v.id ASC`,
    [propietarioId, ...parametros]
  );
  return filas;
}

async function listarPaginaPorPropietario(
  propietarioId,
  rango = {},
  { limite, desplazamiento },
  ejecutor = conexion.obtenerPool()
) {
  const { condiciones, parametros } = construirFiltroFechas(rango);
  const filtro = condiciones.length ? ` AND ${condiciones.join(' AND ')}` : '';
  const [filas] = await ejecutor.execute(
    `${SELECCION} WHERE v.propietario_id = ?${filtro}
      ORDER BY v.fecha ASC, v.id ASC
      LIMIT ${Number(limite)} OFFSET ${Number(desplazamiento)}`,
    [propietarioId, ...parametros]
  );
  return filas;
}

async function contarPorPropietario(
  propietarioId,
  rango = {},
  ejecutor = conexion.obtenerPool()
) {
  const { condiciones, parametros } = construirFiltroFechas(rango);
  const filtro = condiciones.length ? ` AND ${condiciones.join(' AND ')}` : '';
  const [filas] = await ejecutor.execute(
    `SELECT COUNT(*) AS total FROM ventas v WHERE v.propietario_id = ?${filtro}`,
    [propietarioId, ...parametros]
  );
  return Number(filas[0].total);
}

async function listarGlobal(rango = {}, ejecutor = conexion.obtenerPool()) {
  const { condiciones, parametros } = construirFiltroFechas(rango);
  const filtro = condiciones.length ? ` WHERE ${condiciones.join(' AND ')}` : '';
  const [filas] = await ejecutor.execute(
    `${SELECCION}${filtro} ORDER BY v.fecha ASC, v.id ASC`,
    parametros
  );
  return filas;
}

module.exports = {
  insertar,
  buscarPorId,
  buscarPorClaveIdempotencia,
  listarPorPropietario,
  listarPaginaPorPropietario,
  contarPorPropietario,
  listarGlobal,
};

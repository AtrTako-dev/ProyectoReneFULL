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
  if (rango.desde) { condiciones.push('v.fecha >= ?'); parametros.push(rango.desde); }
  if (rango.hasta) { condiciones.push('v.fecha <= ?'); parametros.push(rango.hasta); }
  return { condiciones, parametros };
}

class VentaModelo {
  constructor(baseDatos) { this.baseDatos = baseDatos; }

  async insertar({ propietarioId, fecha, productoId, precioUnitarioMxn, cantidad, totalMxn,
    importacionId = null, idOrigen = null, claveIdempotencia = null }, ejecutor) {
    const [resultado] = await this.baseDatos.consultar(
      `INSERT INTO ventas
         (importacion_id, id_origen, propietario_id, fecha, producto_id,
          precio_unitario_mxn, cantidad, total_mxn, clave_idempotencia)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [importacionId, idOrigen, propietarioId, fecha, productoId, precioUnitarioMxn,
        cantidad, totalMxn, claveIdempotencia], ejecutor
    );
    return this.buscarPorId(resultado.insertId, ejecutor);
  }

  async buscarPorId(idVenta, ejecutor) {
    const [filas] = await this.baseDatos.consultar(`${SELECCION} WHERE v.id = ? LIMIT 1`, [idVenta], ejecutor);
    return filas[0] || null;
  }

  async buscarPorClaveIdempotencia(propietarioId, claveIdempotencia, ejecutor) {
    const [filas] = await this.baseDatos.consultar(
      `${SELECCION} WHERE v.propietario_id = ? AND v.clave_idempotencia = ? LIMIT 1`,
      [propietarioId, claveIdempotencia], ejecutor
    );
    return filas[0] || null;
  }

  async listarPorPropietario(propietarioId, rango = {}, ejecutor) {
    const { condiciones, parametros } = construirFiltroFechas(rango);
    const filtro = condiciones.length ? ` AND ${condiciones.join(' AND ')}` : '';
    const [filas] = await this.baseDatos.consultar(
      `${SELECCION} WHERE v.propietario_id = ?${filtro} ORDER BY v.fecha ASC, v.id ASC`,
      [propietarioId, ...parametros], ejecutor
    );
    return filas;
  }

  async listarPaginaPorPropietario(propietarioId, rango = {}, { limite, desplazamiento }, ejecutor) {
    const { condiciones, parametros } = construirFiltroFechas(rango);
    const filtro = condiciones.length ? ` AND ${condiciones.join(' AND ')}` : '';
    const [filas] = await this.baseDatos.consultar(
      `${SELECCION} WHERE v.propietario_id = ?${filtro}
       ORDER BY v.fecha ASC, v.id ASC LIMIT ${Number(limite)} OFFSET ${Number(desplazamiento)}`,
      [propietarioId, ...parametros], ejecutor
    );
    return filas;
  }

  async contarPorPropietario(propietarioId, rango = {}, ejecutor) {
    const { condiciones, parametros } = construirFiltroFechas(rango);
    const filtro = condiciones.length ? ` AND ${condiciones.join(' AND ')}` : '';
    const [filas] = await this.baseDatos.consultar(
      `SELECT COUNT(*) AS total FROM ventas v WHERE v.propietario_id = ?${filtro}`,
      [propietarioId, ...parametros], ejecutor
    );
    return Number(filas[0].total);
  }

  async listarGlobal(rango = {}, ejecutor) {
    const { condiciones, parametros } = construirFiltroFechas(rango);
    const filtro = condiciones.length ? ` WHERE ${condiciones.join(' AND ')}` : '';
    const [filas] = await this.baseDatos.consultar(
      `${SELECCION}${filtro} ORDER BY v.fecha ASC, v.id ASC`, parametros, ejecutor
    );
    return filas;
  }
}

module.exports = VentaModelo;

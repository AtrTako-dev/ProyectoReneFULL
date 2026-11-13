const conexion = require('../db/conexion');

async function buscarPorId(productoId, ejecutor = conexion.obtenerPool()) {
  const [filas] = await ejecutor.execute(
    `SELECT p.id AS producto_id,
            p.nombre AS producto,
            c.nombre AS categoria,
            p.categoria_id,
            p.precio_actual_mxn,
            p.activo
       FROM productos p
       INNER JOIN categorias c ON c.id = p.categoria_id
      WHERE p.id = ?
      LIMIT 1`,
    [productoId]
  );
  return filas[0] || null;
}

async function listar({ soloActivos = true } = {}, ejecutor = conexion.obtenerPool()) {
  const filtro = soloActivos ? 'WHERE p.activo = 1' : '';
  const [filas] = await ejecutor.execute(
    `SELECT p.id AS producto_id,
            p.nombre AS producto,
            c.nombre AS categoria,
            p.categoria_id,
            p.precio_actual_mxn,
            p.activo
       FROM productos p
       INNER JOIN categorias c ON c.id = p.categoria_id
       ${filtro}
      ORDER BY p.id ASC`
  );
  return filas;
}

module.exports = { buscarPorId, listar };

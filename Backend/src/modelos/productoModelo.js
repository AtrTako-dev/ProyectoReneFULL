const SELECCION = `SELECT p.id AS producto_id,
       p.nombre AS producto,
       c.nombre AS categoria,
       p.categoria_id,
       p.precio_actual_mxn,
       p.activo
  FROM productos p
  INNER JOIN categorias c ON c.id = p.categoria_id`;

class ProductoModelo {
  constructor(baseDatos) { this.baseDatos = baseDatos; }

  async buscarPorId(productoId, ejecutor) {
    const [filas] = await this.baseDatos.consultar(
      `${SELECCION} WHERE p.id = ? LIMIT 1`, [productoId], ejecutor
    );
    return filas[0] || null;
  }

  async listar({ soloActivos = true } = {}, ejecutor) {
    const filtro = soloActivos ? 'WHERE p.activo = 1' : '';
    const [filas] = await this.baseDatos.consultar(
      `${SELECCION} ${filtro} ORDER BY p.id ASC`, [], ejecutor
    );
    return filas;
  }
}

module.exports = ProductoModelo;

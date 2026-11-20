class CategoriaModelo {
  constructor(baseDatos) { this.baseDatos = baseDatos; }

  async buscarPorNombre(nombre, ejecutor) {
    const [filas] = await this.baseDatos.consultar(
      'SELECT id, nombre FROM categorias WHERE nombre = ? LIMIT 1', [nombre], ejecutor
    );
    return filas[0] || null;
  }

  async asegurar(nombre, ejecutor) {
    const existente = await this.buscarPorNombre(nombre, ejecutor);
    if (existente) return existente;
    await this.baseDatos.consultar('INSERT IGNORE INTO categorias (nombre) VALUES (?)', [nombre], ejecutor);
    return this.buscarPorNombre(nombre, ejecutor);
  }

  async listar(ejecutor) {
    const [filas] = await this.baseDatos.consultar(
      'SELECT id, nombre FROM categorias ORDER BY nombre ASC', [], ejecutor
    );
    return filas;
  }
}

module.exports = CategoriaModelo;

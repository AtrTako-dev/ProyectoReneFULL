const crypto = require('node:crypto');

const COLUMNAS = 'id, nombre, correo, rol, activo, creado_en, actualizado_en';

class UsuarioModelo {
  constructor(baseDatos) { this.baseDatos = baseDatos; }

  async crear({ nombre, correo, contrasenaHash, rol }, ejecutor) {
    const id = crypto.randomUUID();
    await this.baseDatos.consultar(
      `INSERT INTO usuarios (id, nombre, correo, password_hash, rol, activo)
       VALUES (?, ?, ?, ?, ?, 1)`, [id, nombre, correo, contrasenaHash, rol], ejecutor
    );
    return this.buscarPorId(id, ejecutor);
  }

  async buscarPorId(id, ejecutor) {
    const [filas] = await this.baseDatos.consultar(
      `SELECT ${COLUMNAS} FROM usuarios WHERE id = ? LIMIT 1`, [id], ejecutor
    );
    return filas[0] || null;
  }

  async buscarPorCorreo(correo, ejecutor) {
    const [filas] = await this.baseDatos.consultar(
      `SELECT ${COLUMNAS}, password_hash FROM usuarios WHERE correo = ? LIMIT 1`, [correo], ejecutor
    );
    return filas[0] || null;
  }

  async listar(ejecutor) {
    const [filas] = await this.baseDatos.consultar(
      `SELECT ${COLUMNAS} FROM usuarios ORDER BY nombre ASC, id ASC`, [], ejecutor
    );
    return filas;
  }

  async actualizarRol(id, rol, ejecutor) {
    const [resultado] = await this.baseDatos.consultar(
      'UPDATE usuarios SET rol = ?, actualizado_en = CURRENT_TIMESTAMP WHERE id = ?', [rol, id], ejecutor
    );
    if (resultado.affectedRows === 0) return null;
    return this.buscarPorId(id, ejecutor);
  }

  async contarVentas(propietarioId, ejecutor) {
    const [filas] = await this.baseDatos.consultar(
      'SELECT COUNT(*) AS total FROM ventas WHERE propietario_id = ?', [propietarioId], ejecutor
    );
    return Number(filas[0].total);
  }
}

module.exports = UsuarioModelo;

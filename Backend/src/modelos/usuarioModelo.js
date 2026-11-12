const crypto = require('node:crypto');
const conexion = require('../db/conexion');

// Traduccion MySQL del modelo `usuarios` de Ismael: id UUID como texto,
// `correo` normalizado, rol y estado activo.
const COLUMNAS = 'id, nombre, correo, rol, activo, creado_en, actualizado_en';

async function crear({ nombre, correo, contrasenaHash, rol }, ejecutor = conexion.obtenerPool()) {
  const id = crypto.randomUUID();
  await ejecutor.execute(
    `INSERT INTO usuarios (id, nombre, correo, password_hash, rol, activo)
     VALUES (?, ?, ?, ?, ?, 1)`,
    [id, nombre, correo, contrasenaHash, rol]
  );
  return buscarPorId(id, ejecutor);
}

async function buscarPorId(id, ejecutor = conexion.obtenerPool()) {
  const [filas] = await ejecutor.execute(
    `SELECT ${COLUMNAS} FROM usuarios WHERE id = ? LIMIT 1`,
    [id]
  );
  return filas[0] || null;
}

async function buscarPorCorreo(correo, ejecutor = conexion.obtenerPool()) {
  const [filas] = await ejecutor.execute(
    `SELECT ${COLUMNAS}, password_hash FROM usuarios WHERE correo = ? LIMIT 1`,
    [correo]
  );
  return filas[0] || null;
}

async function listar(ejecutor = conexion.obtenerPool()) {
  const [filas] = await ejecutor.execute(
    `SELECT ${COLUMNAS} FROM usuarios ORDER BY nombre ASC, id ASC`
  );
  return filas;
}

async function actualizarRol(id, rol, ejecutor = conexion.obtenerPool()) {
  const [resultado] = await ejecutor.execute(
    'UPDATE usuarios SET rol = ?, actualizado_en = CURRENT_TIMESTAMP WHERE id = ?',
    [rol, id]
  );
  if (resultado.affectedRows === 0) {
    return null;
  }
  return buscarPorId(id, ejecutor);
}

async function contarVentas(propietarioId, ejecutor = conexion.obtenerPool()) {
  const [filas] = await ejecutor.execute(
    'SELECT COUNT(*) AS total FROM ventas WHERE propietario_id = ?',
    [propietarioId]
  );
  return Number(filas[0].total);
}

module.exports = {
  crear,
  buscarPorId,
  buscarPorCorreo,
  listar,
  actualizarRol,
  contarVentas,
};

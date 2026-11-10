const { obtenerPool } = require('../db/conexion');

const COLUMNAS_PUBLICAS = 'id, nombre, email, rol, creado_en';

async function crear({ nombre, email, contrasenaHash, rol }) {
  const pool = obtenerPool();
  const [resultado] = await pool.execute(
    'INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES (?, ?, ?, ?)',
    [nombre, email, contrasenaHash, rol]
  );
  return buscarPorId(resultado.insertId);
}

async function buscarPorId(id) {
  const [filas] = await obtenerPool().execute(
    `SELECT ${COLUMNAS_PUBLICAS} FROM usuarios WHERE id = ?`,
    [id]
  );
  return filas[0] || null;
}

async function buscarPorEmail(email) {
  const [filas] = await obtenerPool().execute(
    `SELECT ${COLUMNAS_PUBLICAS}, password_hash FROM usuarios WHERE email = ?`,
    [email]
  );
  return filas[0] || null;
}

async function listar() {
  const [filas] = await obtenerPool().execute(
    `SELECT ${COLUMNAS_PUBLICAS} FROM usuarios ORDER BY id`
  );
  return filas;
}

async function actualizarRol(id, rol) {
  const [resultado] = await obtenerPool().execute(
    'UPDATE usuarios SET rol = ? WHERE id = ?',
    [rol, id]
  );
  if (resultado.affectedRows === 0) {
    return null;
  }
  return buscarPorId(id);
}

async function contarVentas(usuarioId) {
  const [filas] = await obtenerPool().execute(
    'SELECT COUNT(*) AS total FROM ventas WHERE usuario_id = ?',
    [usuarioId]
  );
  return Number(filas[0].total);
}

module.exports = {
  crear,
  buscarPorId,
  buscarPorEmail,
  listar,
  actualizarRol,
  contarVentas,
};

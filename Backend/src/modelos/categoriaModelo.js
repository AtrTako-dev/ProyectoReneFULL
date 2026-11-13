const conexion = require('../db/conexion');

async function buscarPorNombre(nombre, ejecutor = conexion.obtenerPool()) {
  const [filas] = await ejecutor.execute(
    'SELECT id, nombre FROM categorias WHERE nombre = ? LIMIT 1',
    [nombre]
  );
  return filas[0] || null;
}

async function asegurar(nombre, ejecutor = conexion.obtenerPool()) {
  const existente = await buscarPorNombre(nombre, ejecutor);
  if (existente) {
    return existente;
  }
  await ejecutor.execute('INSERT IGNORE INTO categorias (nombre) VALUES (?)', [nombre]);
  return buscarPorNombre(nombre, ejecutor);
}

async function listar(ejecutor = conexion.obtenerPool()) {
  const [filas] = await ejecutor.execute('SELECT id, nombre FROM categorias ORDER BY nombre ASC');
  return filas;
}

module.exports = { buscarPorNombre, asegurar, listar };

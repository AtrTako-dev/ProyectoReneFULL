const mysql = require('mysql2/promise');
const { configuracion } = require('../config/entorno');

let pool = null;

function obtenerPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: configuracion.db.host,
      port: configuracion.db.puerto,
      user: configuracion.db.usuario,
      password: configuracion.db.contrasena,
      database: configuracion.db.nombre,
      charset: 'utf8mb4',
      dateStrings: true,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }
  return pool;
}

async function cerrarPool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = { obtenerPool, cerrarPool };

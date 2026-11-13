const mysql = require('mysql2/promise');
const { configuracion } = require('../config/entornoDatos');

let pool = null;

function opcionesBase() {
  return {
    host: configuracion.db.host,
    port: configuracion.db.puerto,
    user: configuracion.db.usuario,
    password: configuracion.db.contrasena,
    charset: 'utf8mb4',
    dateStrings: true,
    supportBigNumbers: true,
    bigNumberStrings: false,
    waitForConnections: true,
    connectionLimit: configuracion.db.conexiones,
    queueLimit: 0,
  };
}

function obtenerPool() {
  if (!pool) {
    pool = mysql.createPool({
      ...opcionesBase(),
      database: configuracion.db.nombre,
    });
  }
  return pool;
}

async function crearConexion(extra = {}) {
  return mysql.createConnection({
    ...opcionesBase(),
    ...extra,
  });
}

async function cerrarPool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

async function conTransaccion(trabajo) {
  const conexion = await obtenerPool().getConnection();
  try {
    await conexion.beginTransaction();
    const resultado = await trabajo(conexion);
    await conexion.commit();
    return resultado;
  } catch (error) {
    try {
      await conexion.rollback();
    } catch {
      // El error original es el que debe llegar al llamador.
    }
    throw error;
  } finally {
    conexion.release();
  }
}

module.exports = {
  obtenerPool,
  crearConexion,
  cerrarPool,
  conTransaccion,
  opcionesBase,
};

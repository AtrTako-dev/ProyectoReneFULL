const mysql = require('mysql2/promise');
const { configuracion } = require('../config/entorno');

class BaseDatos {
  constructor({ config = configuracion, controladorMysql = mysql } = {}) {
    this.config = config;
    this.controladorMysql = controladorMysql;
    this.pool = null;
  }

  opcionesBase() {
    return {
      host: this.config.db.host,
      port: this.config.db.puerto,
      user: this.config.db.usuario,
      password: this.config.db.contrasena,
      charset: 'utf8mb4',
      dateStrings: true,
      supportBigNumbers: true,
      bigNumberStrings: false,
      waitForConnections: true,
      connectionLimit: this.config.db.conexiones,
      queueLimit: 0,
    };
  }

  obtenerPool() {
    if (!this.pool) {
      this.pool = this.controladorMysql.createPool({
        ...this.opcionesBase(),
        database: this.config.db.nombre,
      });
    }
    return this.pool;
  }

  async abrirConexion(extra = {}) {
    return this.controladorMysql.createConnection({ ...this.opcionesBase(), ...extra });
  }

  async consultar(sql, parametros = [], ejecutor = null) {
    return (ejecutor || this.obtenerPool()).execute(sql, parametros);
  }

  async transaccion(trabajo) {
    const conexion = await this.obtenerPool().getConnection();
    try {
      await conexion.beginTransaction();
      const resultado = await trabajo(conexion);
      await conexion.commit();
      return resultado;
    } catch (error) {
      try {
        await conexion.rollback();
      } catch {
        // Se conserva el error original.
      }
      throw error;
    } finally {
      conexion.release();
    }
  }

  async cerrar() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}

module.exports = { BaseDatos };

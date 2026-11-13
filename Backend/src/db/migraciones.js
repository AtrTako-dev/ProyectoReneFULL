const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { configuracion } = require('../config/entornoDatos');
const { crearConexion } = require('../db/mysql');

const FORMATO_BASE = /^[A-Za-z0-9_]{1,64}$/;

function validarNombreBase(nombre) {
  if (typeof nombre !== 'string' || !FORMATO_BASE.test(nombre)) {
    throw new Error('El nombre de la base solo puede contener letras, números y guion bajo.');
  }
  return nombre;
}

async function crearBaseSiNoExiste(nombreBase) {
  const nombre = validarNombreBase(nombreBase);
  const conexion = await crearConexion();
  try {
    await conexion.query(
      `CREATE DATABASE IF NOT EXISTS \`${nombre}\`
       CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`
    );
  } finally {
    await conexion.end();
  }
}

async function asegurarTablaMigraciones(conexion) {
  await conexion.query(
    `CREATE TABLE IF NOT EXISTS migraciones (
       id INT UNSIGNED NOT NULL AUTO_INCREMENT,
       nombre VARCHAR(255) NOT NULL,
       hash_sha256 CHAR(64) NOT NULL,
       aplicada_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
       PRIMARY KEY (id),
       UNIQUE KEY uq_migraciones_nombre (nombre)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`
  );
}

function listarMigraciones(directorio) {
  if (!fs.existsSync(directorio)) {
    throw new Error(`No existe el directorio de migraciones: ${directorio}`);
  }
  return fs
    .readdirSync(directorio)
    .filter((nombre) => nombre.toLowerCase().endsWith('.sql'))
    .sort();
}

async function aplicarMigraciones({
  nombreBase = configuracion.db.nombre,
  crearBase = true,
  directorio = configuracion.rutas.migraciones,
} = {}) {
  const base = validarNombreBase(nombreBase);
  if (crearBase) await crearBaseSiNoExiste(base);

  const conexion = await crearConexion({
    database: base,
    multipleStatements: true,
  });

  try {
    await asegurarTablaMigraciones(conexion);
    const aplicadas = [];
    const omitidas = [];

    for (const nombre of listarMigraciones(directorio)) {
      const ruta = path.join(directorio, nombre);
      const contenido = fs.readFileSync(ruta, 'utf8');
      const hashSha256 = crypto.createHash('sha256').update(contenido).digest('hex');
      const [existentes] = await conexion.execute(
        'SELECT nombre, hash_sha256 FROM migraciones WHERE nombre = ?',
        [nombre]
      );

      if (existentes.length > 0) {
        if (existentes[0].hash_sha256 !== hashSha256) {
          throw new Error(
            `La migración ${nombre} ya fue aplicada con otro contenido; no se modifica el historial.`
          );
        }
        omitidas.push(nombre);
        continue;
      }

      // MySQL no permite transacciones DDL. El archivo usa CREATE TABLE IF NOT
      // EXISTS para que un reintento tras un fallo sea seguro y repetible.
      await conexion.query(contenido);
      await conexion.execute(
        'INSERT INTO migraciones (nombre, hash_sha256) VALUES (?, ?)',
        [nombre, hashSha256]
      );
      aplicadas.push(nombre);
    }

    return { base, aplicadas, omitidas };
  } finally {
    await conexion.end();
  }
}

module.exports = {
  validarNombreBase,
  crearBaseSiNoExiste,
  aplicarMigraciones,
  listarMigraciones,
};

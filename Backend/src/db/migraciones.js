const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { configuracion } = require('../config/entorno');
const { crearConexion } = require('./conexion');

const FORMATO_BASE = /^[A-Za-z0-9_]{1,64}$/;
const DIRECTORIO_MIGRACIONES = path.join(__dirname, '..', '..', 'db', 'migraciones');

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
       hash_sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
       aplicado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
       PRIMARY KEY (id),
       UNIQUE KEY uq_migraciones_nombre (nombre)
     ) ENGINE=InnoDB`
  );
}

function listarArchivos(directorio) {
  if (!fs.existsSync(directorio)) {
    throw new Error(`No existe el directorio de migraciones: ${directorio}`);
  }
  return fs
    .readdirSync(directorio)
    .filter((archivo) => archivo.toLowerCase().endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b, 'en'));
}

async function aplicarMigraciones({
  crearBase = true,
  directorio = DIRECTORIO_MIGRACIONES,
  nombreBase = configuracion.db.nombre,
} = {}) {
  const base = validarNombreBase(nombreBase);
  if (crearBase) {
    await crearBaseSiNoExiste(base);
  }

  const archivos = listarArchivos(directorio);
  const conexion = await crearConexion({ database: base, multipleStatements: true });
  const aplicadas = [];
  const omitidas = [];
  try {
    await asegurarTablaMigraciones(conexion);
    for (const archivo of archivos) {
      const ruta = path.join(directorio, archivo);
      const contenido = fs.readFileSync(ruta);
      const hash = crypto.createHash('sha256').update(contenido).digest('hex');
      const [filas] = await conexion.execute(
        'SELECT hash_sha256 FROM migraciones WHERE nombre = ? LIMIT 1',
        [archivo]
      );
      if (filas.length > 0) {
        if (filas[0].hash_sha256 !== hash) {
          throw new Error(
            `La migración ${archivo} ya fue aplicada con otro contenido. ` +
              'Cree una migración nueva en lugar de editar una aplicada.'
          );
        }
        omitidas.push(archivo);
        continue;
      }
      await conexion.query(contenido.toString('utf8'));
      await conexion.execute(
        'INSERT INTO migraciones (nombre, hash_sha256) VALUES (?, ?)',
        [archivo, hash]
      );
      aplicadas.push(archivo);
    }
  } finally {
    await conexion.end();
  }

  return { base, aplicadas, omitidas };
}

module.exports = {
  DIRECTORIO_MIGRACIONES,
  aplicarMigraciones,
  crearBaseSiNoExiste,
  listarArchivos,
  validarNombreBase,
};

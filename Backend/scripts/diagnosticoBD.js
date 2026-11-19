const fs = require('node:fs');
const path = require('node:path');
const { BaseDatos } = require('../src/db/conexion');
const { configuracion } = require('../src/config/entorno');
const {
  DIRECTORIO_MIGRACIONES,
  HASHES_001_OBSOLETOS,
  hashContenido,
  hashesAceptables,
  validarNombreBase,
} = require('../src/db/migraciones');

const ARCHIVO_INICIAL = '001_esquema_inicial.sql';
const RUTA_INICIAL = path.join(DIRECTORIO_MIGRACIONES, ARCHIVO_INICIAL);

function clasificarHash(hash, hashesActuales) {
  if (!hash) return 'sin registro';
  if (hashesActuales.has(hash)) return 'coincide con el actual';
  if (HASHES_001_OBSOLETOS.has(hash)) return 'coincide con el histórico 43c2886';
  return 'desconocido';
}

function versionMinima(version) {
  const encontrada = String(version).match(/(\d+)\.(\d+)\.(\d+)/);
  if (!encontrada) return false;
  const [, mayor, menor, parche] = encontrada.map(Number);
  return mayor > 8 || (mayor === 8 && (menor > 0 || (menor === 0 && parche >= 16)));
}

function accionRecomendada({ esMariaDb, versionCompatible, collationDisponible, clasificacion }) {
  if (esMariaDb || !versionCompatible || !collationDisponible) {
    return 'Instala o inicia MySQL 8.0.16 o superior con utf8mb4_0900_ai_ci y vuelve a ejecutar npm run db:diagnostico.';
  }
  if (clasificacion === 'coincide con el histórico 43c2886' || clasificacion === 'desconocido') {
    return 'Detén la migración y conserva la base sin cambios; revisa docs/HISTORIAL_MIGRACIONES.md antes de elegir una conversión.';
  }
  return 'Ejecuta npm run db:migrar; el runner aplicará la migración pendiente o verificará el esquema existente.';
}

async function diagnosticar() {
  const base = validarNombreBase(configuracion.db.nombre);
  const hashesActuales = hashesAceptables(fs.readFileSync(RUTA_INICIAL));
  const hashActual = hashContenido(fs.readFileSync(RUTA_INICIAL));
  const conexion = await new BaseDatos().abrirConexion();

  try {
    const [[servidor]] = await conexion.query(
      `SELECT VERSION() AS version, @@version_comment AS comentario,
              CURRENT_USER() AS usuario_conectado, @@collation_server AS collation_servidor`
    );
    const [collations] = await conexion.query("SHOW COLLATION LIKE 'utf8mb4_0900_ai_ci'");
    const [grants] = await conexion.query('SHOW GRANTS');
    const [bases] = await conexion.execute(
      'SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?',
      [base]
    );
    const baseExiste = bases.length > 0;
    let tablas = [];
    let migraciones = [];

    if (baseExiste) {
      const [filasTablas] = await conexion.execute(
        'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME',
        [base]
      );
      tablas = filasTablas.map((fila) => fila.TABLE_NAME);

      if (tablas.includes('migraciones')) {
        const [filasMigraciones] = await conexion.execute(
          `SELECT nombre, hash_sha256, aplicado_en FROM \`${base}\`.migraciones ORDER BY id`
        );
        migraciones = filasMigraciones.map((fila) => ({
          ...fila,
          clasificacion: fila.nombre === ARCHIVO_INICIAL
            ? clasificarHash(fila.hash_sha256, hashesActuales)
            : 'no aplica a 001',
        }));
      }
    }

    const registroInicial = migraciones.find((fila) => fila.nombre === ARCHIVO_INICIAL);
    const huellaServidor = `${servidor.version} ${servidor.comentario}`;
    const esMariaDb = /mariadb/i.test(huellaServidor);
    const tipoServidor = esMariaDb
      ? 'MariaDB'
      : /mysql/i.test(huellaServidor)
        ? 'MySQL'
        : 'Servidor compatible';
    const compatible = versionMinima(servidor.version);
    const collationDisponible = collations.length > 0;
    const clasificacion = clasificarHash(registroInicial?.hash_sha256, hashesActuales);

    const resultado = {
      servidor: {
        tipo: tipoServidor,
        version: servidor.version,
        comentario: servidor.comentario,
        mysql_8_0_16_o_superior: compatible,
        aviso: esMariaDb ? 'MariaDB no cumple el requisito de MySQL 8.' : null,
      },
      collation: {
        servidor: servidor.collation_servidor,
        utf8mb4_0900_ai_ci_disponible: collationDisponible,
      },
      usuario_conectado: servidor.usuario_conectado,
      conexion: {
        host: configuracion.db.host,
        puerto: configuracion.db.puerto,
      },
      permisos: grants.map((fila) => Object.values(fila)[0]),
      base: {
        nombre: base,
        existe: baseExiste,
        tablas,
        migraciones,
      },
      migracion_001: {
        hash_actual: hashActual,
        hash_registrado: registroInicial?.hash_sha256 ?? null,
        clasificacion,
      },
    };

    resultado.accion_recomendada = accionRecomendada({
      esMariaDb,
      versionCompatible: compatible,
      collationDisponible,
      clasificacion,
    });
    process.stdout.write(`${JSON.stringify(resultado, null, 2)}\n`);
  } finally {
    await conexion.end();
  }
}

if (require.main === module) {
  diagnosticar().catch((error) => {
    console.error(`No fue posible diagnosticar MySQL: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { accionRecomendada, clasificarHash, diagnosticar, versionMinima };

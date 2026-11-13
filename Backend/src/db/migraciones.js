const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { configuracion } = require('../config/entorno');
const { crearConexion } = require('./conexion');

const FORMATO_BASE = /^[A-Za-z0-9_]{1,64}$/;
const PREFIJO_BASE_PRUEBAS = 'renefull_test_';
const FORMATO_BASE_PRUEBAS = /^renefull_test_[A-Za-z0-9_]{1,50}$/;
const DIRECTORIO_MIGRACIONES = path.join(__dirname, '..', '..', 'db', 'migraciones');

// El runner original calculaba SHA-256 sobre los bytes del archivo. En Windows
// con autocrlf el mismo archivo puede tener CRLF o LF, por lo que un hash válido
// de una máquina no coincidía con el de otra. El hash canónico normaliza los
// finales de línea a LF; al comparar se aceptan también las variantes históricas
// CRLF/CR para no alterar registros ya escritos.
const HASHES_001_OBSOLETOS = new Set([
  // 001 de 43c2886, esquema BIGINT/email incompatible con la API actual.
  '2d2e24dccc55d24d9b16dbec11e25c8609a18557964ba9d5aa0ec7a2c3460df3',
  '00c0ff26216a1d2e311e3cd6958217d345da0805b4013a20d575cd6352391207',
  '7c15ef4f02fe3eba8d07548e735446d7e9e518cf2cf810c0c9975158c95d5799',
]);

const ESQUEMA_ESPERADO = {
  usuarios: {
    columnas: {
      id: ['char(36)', 'NO'],
      nombre: ['varchar(120)', 'NO'],
      correo: ['varchar(254)', 'NO'],
      password_hash: ['varchar(255)', 'NO'],
      rol: ['varchar(20)', 'NO'],
      activo: ['tinyint(1)', 'NO'],
      creado_en: ['timestamp', 'NO'],
      actualizado_en: ['timestamp', 'NO'],
    },
    unicas: ['uq_usuarios_correo'],
    checks: [
      'ck_usuarios_id_uuid',
      'ck_usuarios_nombre',
      'ck_usuarios_correo',
      'ck_usuarios_hash',
      'ck_usuarios_rol',
      'ck_usuarios_activo',
    ],
  },
  categorias: {
    columnas: {
      id: ['smallint unsigned', 'NO'],
      nombre: ['varchar(60)', 'NO'],
    },
    unicas: ['uq_categorias_nombre'],
    checks: ['ck_categorias_nombre'],
  },
  productos: {
    columnas: {
      id: ['varchar(20)', 'NO'],
      nombre: ['varchar(120)', 'NO'],
      categoria_id: ['smallint unsigned', 'NO'],
      precio_actual_mxn: ['decimal(12,2)', 'NO'],
      activo: ['tinyint(1)', 'NO'],
      creado_en: ['timestamp', 'NO'],
      actualizado_en: ['timestamp', 'NO'],
    },
    unicas: [],
    checks: [
      'ck_productos_id',
      'ck_productos_nombre',
      'ck_productos_precio',
      'ck_productos_activo',
    ],
  },
  importaciones: {
    columnas: {
      id: ['bigint unsigned', 'NO'],
      conjunto: ['varchar(80)', 'NO'],
      archivo: ['varchar(255)', 'NO'],
      hash_sha256: ['char(64)', 'NO'],
      perfil_demanda: ['varchar(80)', 'NO'],
      fuente: ['varchar(40)', 'NO'],
      es_demostracion: ['tinyint(1)', 'NO'],
      moneda: ['char(3)', 'NO'],
      periodo_inicio: ['date', 'NO'],
      periodo_fin: ['date', 'NO'],
      cantidad_registros: ['int', 'NO'],
      propietario_id: ['char(36)', 'NO'],
      importado_por: ['char(36)', 'YES'],
      importado_en: ['timestamp', 'NO'],
    },
    unicas: [
      'uq_importaciones_conjunto',
      'uq_importaciones_hash',
      'uq_importaciones_id_propietario',
    ],
    checks: [
      'ck_importaciones_conjunto',
      'ck_importaciones_archivo',
      'ck_importaciones_hash',
      'ck_importaciones_perfil',
      'ck_importaciones_fuente',
      'ck_importaciones_demostracion',
      'ck_importaciones_moneda',
      'ck_importaciones_periodo',
      'ck_importaciones_registros',
      'ck_importaciones_propietario_uuid',
    ],
  },
  ventas: {
    columnas: {
      id: ['bigint unsigned', 'NO'],
      importacion_id: ['bigint unsigned', 'YES'],
      id_origen: ['varchar(64)', 'YES'],
      propietario_id: ['char(36)', 'NO'],
      fecha: ['date', 'NO'],
      producto_id: ['varchar(20)', 'NO'],
      precio_unitario_mxn: ['decimal(12,2)', 'NO'],
      cantidad: ['int', 'NO'],
      total_mxn: ['decimal(14,2)', 'NO'],
      clave_idempotencia: ['char(36)', 'YES'],
      creado_en: ['timestamp', 'NO'],
    },
    unicas: ['uq_ventas_importacion_origen', 'uq_ventas_propietario_clave'],
    checks: [
      'ck_ventas_origen',
      'ck_ventas_origen_texto',
      'ck_ventas_propietario_uuid',
      'ck_ventas_fecha',
      'ck_ventas_cantidad',
      'ck_ventas_precio',
      'ck_ventas_total',
      'ck_ventas_total_coherente',
      'ck_ventas_clave_uuid',
    ],
  },
  migraciones: {
    columnas: {
      id: ['int unsigned', 'NO'],
      nombre: ['varchar(255)', 'NO'],
      hash_sha256: ['char(64)', 'NO'],
      aplicado_en: ['timestamp', 'NO'],
    },
    unicas: ['uq_migraciones_nombre'],
    checks: [],
  },
};

const CLAVES_FORANEAS_ESPERADAS = [
  {
    tabla: 'productos',
    nombre: 'fk_productos_categoria',
    columnas: ['categoria_id'],
    referencia: { tabla: 'categorias', columnas: ['id'] },
  },
  {
    tabla: 'importaciones',
    nombre: 'fk_importaciones_propietario',
    columnas: ['propietario_id'],
    referencia: { tabla: 'usuarios', columnas: ['id'] },
  },
  {
    tabla: 'importaciones',
    nombre: 'fk_importaciones_importador',
    columnas: ['importado_por'],
    referencia: { tabla: 'usuarios', columnas: ['id'] },
  },
  {
    tabla: 'ventas',
    nombre: 'fk_ventas_importacion_propietario',
    columnas: ['importacion_id', 'propietario_id'],
    referencia: { tabla: 'importaciones', columnas: ['id', 'propietario_id'] },
  },
  {
    tabla: 'ventas',
    nombre: 'fk_ventas_propietario',
    columnas: ['propietario_id'],
    referencia: { tabla: 'usuarios', columnas: ['id'] },
  },
  {
    tabla: 'ventas',
    nombre: 'fk_ventas_producto',
    columnas: ['producto_id'],
    referencia: { tabla: 'productos', columnas: ['id'] },
  },
];

const VERIFICADORES_POR_MIGRACION = new Map([
  ['001_esquema_inicial.sql', verificarEsquemaBase],
]);

function validarNombreBase(nombre) {
  if (typeof nombre !== 'string' || !FORMATO_BASE.test(nombre)) {
    throw new Error('El nombre de la base solo puede contener letras, números y guion bajo.');
  }
  return nombre;
}

function validarNombreBasePruebas(nombre) {
  if (typeof nombre !== 'string' || !FORMATO_BASE_PRUEBAS.test(nombre)) {
    throw new Error(
      `La base de pruebas debe empezar con "${PREFIJO_BASE_PRUEBAS}", usar solo letras, ` +
        'números y guion bajo, y no superar 64 caracteres.'
    );
  }
  return nombre;
}

function generarNombreBasePruebas() {
  const sufijo = `${Date.now().toString(36)}_${crypto.randomBytes(6).toString('hex')}`;
  return validarNombreBasePruebas(`${PREFIJO_BASE_PRUEBAS}${sufijo}`);
}

function normalizarContenido(contenido) {
  return contenido.toString('utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function hashSha256(texto) {
  return crypto.createHash('sha256').update(texto, 'utf8').digest('hex');
}

function hashContenido(contenido) {
  return hashSha256(normalizarContenido(contenido));
}

function hashesAceptables(contenido) {
  const texto = normalizarContenido(contenido);
  return new Set([
    hashSha256(texto),
    hashSha256(texto.replace(/\n/g, '\r\n')),
    hashSha256(texto.replace(/\n/g, '\r')),
  ]);
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

function agregarDiferencia(diferencias, mensaje) {
  diferencias.push(mensaje);
}

async function verificarEsquemaBase(conexion, esquema = conexion.config.database) {
  const diferencias = [];
  const [tablas] = await conexion.execute(
    'SELECT TABLE_NAME FROM information_schema.tables WHERE table_schema = ?',
    [esquema]
  );
  const tablasPresentes = new Set(tablas.map((fila) => fila.TABLE_NAME));
  for (const tabla of Object.keys(ESQUEMA_ESPERADO)) {
    if (!tablasPresentes.has(tabla)) {
      agregarDiferencia(diferencias, `falta la tabla ${tabla}`);
    }
  }

  const [columnas] = await conexion.execute(
    `SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
       FROM information_schema.columns
      WHERE table_schema = ?`,
    [esquema]
  );
  const columnasPresentes = new Map(
    columnas.map((fila) => [
      `${fila.TABLE_NAME}.${fila.COLUMN_NAME}`,
      [String(fila.COLUMN_TYPE).toLowerCase(), fila.IS_NULLABLE],
    ])
  );
  for (const [tabla, definicion] of Object.entries(ESQUEMA_ESPERADO)) {
    for (const [columna, esperado] of Object.entries(definicion.columnas)) {
      const clave = `${tabla}.${columna}`;
      const actual = columnasPresentes.get(clave);
      if (!actual) {
        agregarDiferencia(diferencias, `falta la columna ${clave}`);
        continue;
      }
      if (actual[0] !== esperado[0]) {
        agregarDiferencia(
          diferencias,
          `${clave} tiene tipo ${actual[0]} y se esperaba ${esperado[0]}`
        );
      }
      if (actual[1] !== esperado[1]) {
        agregarDiferencia(
          diferencias,
          `${clave} tiene nulabilidad ${actual[1]} y se esperaba ${esperado[1]}`
        );
      }
    }
  }

  const [restricciones] = await conexion.execute(
    `SELECT TABLE_NAME, CONSTRAINT_NAME, CONSTRAINT_TYPE
       FROM information_schema.TABLE_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = ?`,
    [esquema]
  );
  const restriccionesPresentes = new Set(
    restricciones.map(
      (fila) => `${fila.TABLE_NAME}.${fila.CONSTRAINT_NAME}.${fila.CONSTRAINT_TYPE}`
    )
  );
  for (const [tabla, definicion] of Object.entries(ESQUEMA_ESPERADO)) {
    for (const nombre of definicion.unicas) {
      const clave = `${tabla}.${nombre}.UNIQUE`;
      if (!restriccionesPresentes.has(clave)) {
        agregarDiferencia(diferencias, `falta la restricción ${clave}`);
      }
    }
    for (const nombre of definicion.checks) {
      const clave = `${tabla}.${nombre}.CHECK`;
      if (!restriccionesPresentes.has(clave)) {
        agregarDiferencia(diferencias, `falta la restricción ${clave}`);
      }
    }
  }

  const [foraneas] = await conexion.execute(
    `SELECT TABLE_NAME, CONSTRAINT_NAME, COLUMN_NAME,
            REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME, ORDINAL_POSITION
       FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = ? AND REFERENCED_TABLE_NAME IS NOT NULL
      ORDER BY TABLE_NAME, CONSTRAINT_NAME, ORDINAL_POSITION`,
    [esquema]
  );
  const foraneasPresentes = new Map();
  for (const fila of foraneas) {
    const clave = `${fila.TABLE_NAME}.${fila.CONSTRAINT_NAME}`;
    if (!foraneasPresentes.has(clave)) {
      foraneasPresentes.set(clave, []);
    }
    foraneasPresentes.get(clave).push({
      columna: fila.COLUMN_NAME,
      tablaReferenciada: fila.REFERENCED_TABLE_NAME,
      columnaReferenciada: fila.REFERENCED_COLUMN_NAME,
    });
  }
  for (const esperada of CLAVES_FORANEAS_ESPERADAS) {
    const clave = `${esperada.tabla}.${esperada.nombre}`;
    const actual = foraneasPresentes.get(clave);
    if (!actual) {
      agregarDiferencia(diferencias, `falta la clave foránea ${clave}`);
      continue;
    }
    const columnasActuales = actual.map((item) => item.columna);
    const tablasReferenciadas = actual.map((item) => item.tablaReferenciada);
    const columnasReferenciadas = actual.map((item) => item.columnaReferenciada);
    if (
      columnasActuales.join(',') !== esperada.columnas.join(',') ||
      new Set(tablasReferenciadas).size !== 1 ||
      tablasReferenciadas[0] !== esperada.referencia.tabla ||
      columnasReferenciadas.join(',') !== esperada.referencia.columnas.join(',')
    ) {
      agregarDiferencia(
        diferencias,
        `la clave foránea ${clave} no coincide con la relación esperada`
      );
    }
  }

  if (diferencias.length > 0) {
    throw new Error(
      'El esquema existente no coincide con el esperado. No se registrará la migración ' +
        'ni se modificará la tabla migraciones. Diferencias: ' +
        diferencias.join('; ')
    );
  }
}

async function tablasDeBase(conexion, esquema) {
  const [filas] = await conexion.execute(
    'SELECT TABLE_NAME FROM information_schema.tables WHERE table_schema = ?',
    [esquema]
  );
  return filas.map((fila) => fila.TABLE_NAME);
}

// Si la base ya tiene tablas de negocio pero no tiene registros de migración,
// se verifica el esquema ANTES de ejecutar cualquier DDL. Así una base ajena o
// un esquema viejo no queda a medio crear ni se registra una migración falsa.
async function verificarEsquemaPreexistente(conexion, base, archivos) {
  if (archivos.length === 0) {
    return false;
  }
  const tablas = (await tablasDeBase(conexion, base)).filter(
    (tabla) => tabla !== 'migraciones'
  );
  if (tablas.length === 0) {
    return false;
  }

  if (archivos.length !== 1) {
    throw new Error(
      `La base ${base} tiene tablas de negocio pero no registros de migración, y hay ` +
        `${archivos.length} migraciones. No se puede determinar el punto de partida sin ` +
        'revisión manual; no se ejecutó ningún DDL ni se registró nada.'
    );
  }

  const esperadas = new Set(Object.keys(ESQUEMA_ESPERADO));
  const inesperadas = tablas.filter((tabla) => !esperadas.has(tabla));
  if (inesperadas.length > 0) {
    throw new Error(
      `La base ${base} contiene tablas que no pertenecen al esquema esperado: ` +
        `${inesperadas.join(', ')}. No se ejecutó ningún DDL ni se registró la migración.`
    );
  }

  const verificador = VERIFICADORES_POR_MIGRACION.get(archivos[0]);
  if (!verificador) {
    throw new Error(
      `No hay una verificación de esquema registrada para la migración ${archivos[0]}. ` +
        'Agregue un verificador en src/db/migraciones.js antes de aplicarla.'
    );
  }
  await verificador(conexion, base);
  return true;
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
    const [registros] = await conexion.execute('SELECT COUNT(*) AS total FROM migraciones');
    const sinRegistros = Number(registros[0].total) === 0;
    const esquemaPreexistenteVerificado = sinRegistros
      ? await verificarEsquemaPreexistente(conexion, base, archivos)
      : false;

    for (const archivo of archivos) {
      const verificador = VERIFICADORES_POR_MIGRACION.get(archivo);
      if (!verificador) {
        throw new Error(
          `No hay una verificación de esquema registrada para la migración ${archivo}. ` +
            'Agregue un verificador en src/db/migraciones.js antes de aplicarla.'
        );
      }

      const ruta = path.join(directorio, archivo);
      const contenido = fs.readFileSync(ruta);
      const hash = hashContenido(contenido);
      const aceptables = hashesAceptables(contenido);
      const [filas] = await conexion.execute(
        'SELECT hash_sha256 FROM migraciones WHERE nombre = ? LIMIT 1',
        [archivo]
      );
      if (filas.length > 0) {
        if (!aceptables.has(filas[0].hash_sha256)) {
          if (HASHES_001_OBSOLETOS.has(filas[0].hash_sha256)) {
            throw new Error(
              `La migración ${archivo} fue aplicada con el DDL anterior incompatible ` +
                `(hash ${filas[0].hash_sha256}). La base no se modificó. Consulte ` +
                'docs/HISTORIAL_MIGRACIONES.md y defina una ruta de conversión segura; ' +
                'no edite la tabla migraciones ni convierta el esquema automáticamente.'
            );
          }
          throw new Error(
            `La migración ${archivo} ya fue aplicada con otro contenido. ` +
              'Cree una migración nueva en lugar de editar una aplicada.'
          );
        }
        await verificador(conexion, base);
        omitidas.push(archivo);
        continue;
      }

      // Si la base ya existía con el esquema completo, ya se verificó y no se
      // vuelve a ejecutar el DDL: se registra únicamente tras la verificación.
      const yaVerificada =
        esquemaPreexistenteVerificado && archivo === archivos[0];
      if (!yaVerificada) {
        await conexion.query(contenido.toString('utf8'));
        await verificador(conexion, base);
      }
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
  PREFIJO_BASE_PRUEBAS,
  ESQUEMA_ESPERADO,
  aplicarMigraciones,
  crearBaseSiNoExiste,
  generarNombreBasePruebas,
  hashesAceptables,
  hashContenido,
  listarArchivos,
  validarNombreBase,
  validarNombreBasePruebas,
  verificarEsquemaBase,
};

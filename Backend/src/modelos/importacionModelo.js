const conexion = require('../db/conexion');

const COLUMNAS = `id, conjunto, archivo, hash_sha256, perfil_demanda, fuente,
  es_demostracion, moneda, periodo_inicio, periodo_fin, cantidad_registros,
  propietario_id, importado_por, importado_en`;

async function buscarPorConjunto(conjunto, ejecutor = conexion.obtenerPool()) {
  const [filas] = await ejecutor.execute(
    `SELECT ${COLUMNAS} FROM importaciones WHERE conjunto = ? LIMIT 1`,
    [conjunto]
  );
  return filas[0] || null;
}

async function buscarPorHash(hashSha256, ejecutor = conexion.obtenerPool()) {
  const [filas] = await ejecutor.execute(
    `SELECT ${COLUMNAS} FROM importaciones WHERE hash_sha256 = ? LIMIT 1`,
    [hashSha256]
  );
  return filas[0] || null;
}

async function crear(
  {
    conjunto,
    archivo,
    hashSha256,
    perfilDemanda,
    fuente = 'datos_simulados',
    esDemostracion = true,
    moneda = 'MXN',
    periodoInicio,
    periodoFin,
    cantidadRegistros,
    propietarioId,
    importadoPor = null,
  },
  ejecutor = conexion.obtenerPool()
) {
  const [resultado] = await ejecutor.execute(
    `INSERT INTO importaciones
       (conjunto, archivo, hash_sha256, perfil_demanda, fuente, es_demostracion, moneda,
        periodo_inicio, periodo_fin, cantidad_registros, propietario_id, importado_por)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      conjunto,
      archivo,
      hashSha256,
      perfilDemanda,
      fuente,
      esDemostracion ? 1 : 0,
      moneda,
      periodoInicio,
      periodoFin,
      cantidadRegistros,
      propietarioId,
      importadoPor,
    ]
  );
  return resultado.insertId;
}

module.exports = { buscarPorConjunto, buscarPorHash, crear };

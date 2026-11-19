const COLUMNAS = `id, conjunto, archivo, hash_sha256, perfil_demanda, fuente,
  es_demostracion, moneda, periodo_inicio, periodo_fin, cantidad_registros,
  propietario_id, importado_por, importado_en`;

class ImportacionModelo {
  constructor(baseDatos) { this.baseDatos = baseDatos; }

  async buscarPorConjunto(conjunto, ejecutor) {
    const [filas] = await this.baseDatos.consultar(
      `SELECT ${COLUMNAS} FROM importaciones WHERE conjunto = ? LIMIT 1`, [conjunto], ejecutor
    );
    return filas[0] || null;
  }

  async buscarPorHash(hashSha256, ejecutor) {
    const [filas] = await this.baseDatos.consultar(
      `SELECT ${COLUMNAS} FROM importaciones WHERE hash_sha256 = ? LIMIT 1`, [hashSha256], ejecutor
    );
    return filas[0] || null;
  }

  async crear({
    conjunto, archivo, hashSha256, perfilDemanda, fuente = 'datos_simulados',
    esDemostracion = true, moneda = 'MXN', periodoInicio, periodoFin,
    cantidadRegistros, propietarioId, importadoPor = null,
  }, ejecutor) {
    const [resultado] = await this.baseDatos.consultar(
      `INSERT INTO importaciones
         (conjunto, archivo, hash_sha256, perfil_demanda, fuente, es_demostracion, moneda,
          periodo_inicio, periodo_fin, cantidad_registros, propietario_id, importado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [conjunto, archivo, hashSha256, perfilDemanda, fuente, esDemostracion ? 1 : 0,
        moneda, periodoInicio, periodoFin, cantidadRegistros, propietarioId, importadoPor],
      ejecutor
    );
    return resultado.insertId;
  }
}

module.exports = ImportacionModelo;

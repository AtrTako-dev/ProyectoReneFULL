export class MySqlForecastModelRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async find(modelKey, dataFingerprint) {
    if (!this.pool) throw new Error('Configura MySQL para cargar el modelo de pronóstico.');
    const [rows] = await this.pool.execute(
      `SELECT artifact_json
       FROM forecast_model_artifacts
       WHERE model_key = ? AND data_fingerprint = ?
       LIMIT 1`,
      [modelKey, dataFingerprint],
    );
    if (rows.length === 0) return null;
    return typeof rows[0].artifact_json === 'string'
      ? JSON.parse(rows[0].artifact_json)
      : rows[0].artifact_json;
  }

  async save(artifact) {
    if (!this.pool) throw new Error('Configura MySQL para guardar el modelo de pronóstico.');
    await this.pool.execute(
      `INSERT INTO forecast_model_artifacts
         (model_key, model_version, data_fingerprint, trained_at, artifact_json)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         model_version = VALUES(model_version),
         data_fingerprint = VALUES(data_fingerprint),
         trained_at = VALUES(trained_at),
         artifact_json = VALUES(artifact_json)`,
      [
        artifact.modelKey,
        artifact.modelVersion,
        artifact.dataFingerprint,
        artifact.trainedAt.slice(0, 23).replace('T', ' '),
        JSON.stringify(artifact),
      ],
    );
  }
}

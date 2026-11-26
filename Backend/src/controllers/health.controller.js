export function createHealthController(databasePool) {
  return async function getHealth(_request, response) {
    try {
      if (!databasePool) throw new Error('Database pool is not configured.');
      await databasePool.query('SELECT 1');
      response.status(200).json({
        status: 'ok',
        service: 'more-stock-api',
        database: 'ok',
      });
    } catch {
      response.status(503).json({
        status: 'unavailable',
        service: 'more-stock-api',
        database: 'unavailable',
      });
    }
  };
}

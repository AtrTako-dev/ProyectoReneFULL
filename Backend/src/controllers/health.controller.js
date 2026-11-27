export function createHealthController(databasePool, readiness = () => 'ready') {
  return async function getHealth(_request, response) {
    try {
      if (!databasePool) throw new Error('Database pool is not configured.');
      await databasePool.query('SELECT 1');
      if (readiness() === 'failed') {
        response.status(503).json({
          status: 'unavailable',
          service: 'more-stock-api',
          database: 'ok',
        });
        return;
      }
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

import { parentPort, workerData } from 'node:worker_threads';
import { mysqlPool } from '../config/mysql-pool.js';
import { MySqlForecastModelRepository } from '../repositories/mysql-forecast-model.repository.js';
import { ForecastService } from '../services/forecast.service.js';

function seriesKey(businessId, productId) {
  return `${String(businessId)}\u001f${String(productId)}`;
}

function createSnapshotRepository({ businesses, products, sales }) {
  const businessById = new Map(businesses.map(business => [String(business.businessId), business]));
  const productByKey = new Map(products.map(product => [
    seriesKey(product.businessId, product.productId),
    product,
  ]));
  const salesByKey = new Map();

  for (const sale of sales) {
    const key = seriesKey(sale.businessId, sale.productId);
    if (!salesByKey.has(key)) salesByKey.set(key, []);
    salesByKey.get(key).push(sale);
  }

  return {
    getBusinesses: () => [...businessById.values()],
    getBusiness: businessId => businessById.get(String(businessId ?? '')) ?? null,
    getProducts: businessId => products.filter(product => String(product.businessId) === String(businessId)),
    getProduct: (businessId, productId) => productByKey.get(seriesKey(businessId, productId)) ?? null,
    getSeries: (businessId, productId) => salesByKey.get(seriesKey(businessId, productId)) ?? [],
  };
}

try {
  if (!mysqlPool) throw new Error('MySQL no está configurado.');
  const forecastService = new ForecastService(createSnapshotRepository(workerData), {
    artifactRepository: new MySqlForecastModelRepository(mysqlPool),
  });
  await forecastService.initialize();
  await mysqlPool.end();
  parentPort.postMessage({ ready: true });
} catch {
  await mysqlPool?.end().catch(() => {});
  parentPort.postMessage({ ready: false });
  process.exitCode = 1;
}

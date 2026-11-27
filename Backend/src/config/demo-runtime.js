import { Worker } from 'node:worker_threads';
import { demoAccounts, demoModeEnabled } from './env.js';
import { mysqlPool, requireMysqlPool } from './mysql-pool.js';
import { MySqlAuthRepository } from '../repositories/mysql-auth.repository.js';
import { MySqlForecastModelRepository } from '../repositories/mysql-forecast-model.repository.js';
import { MySqlSalesRepository } from '../repositories/mysql-sales.repository.js';
import { AuthService } from '../services/auth.service.js';
import { DatabaseInitializer } from '../services/database-initializer.service.js';
import { DemoDataSeeder } from '../services/demo-data-seeder.service.js';
import { ForecastService } from '../services/forecast.service.js';
import { InventoryService } from '../services/inventory.service.js';
import { recommendationService } from '../services/recommendation.service.js';
import { explanationService } from '../services/explanation.service.js';
import { calendarService } from '../services/calendar.service.js';

export const authService = new AuthService({
  repository: new MySqlAuthRepository(mysqlPool),
  businesses: [],
  demoAccounts,
});
export const salesRepository = new MySqlSalesRepository(mysqlPool);
export const forecastService = new ForecastService(salesRepository, {
  artifactRepository: new MySqlForecastModelRepository(mysqlPool),
});
export const inventoryService = new InventoryService(mysqlPool);

const databaseInitializer = new DatabaseInitializer(mysqlPool);
const demoDataSeeder = mysqlPool
  ? new DemoDataSeeder({ pool: mysqlPool })
  : null;
let forecastWorker = null;
let forecastInitialization = null;

function createForecastSnapshot() {
  const businesses = salesRepository.getBusinesses();
  const products = businesses.flatMap(business => salesRepository.getProducts(business.businessId));
  const sales = products.flatMap(product => salesRepository.getSeries(product.businessId, product.productId));
  return { businesses, products, sales };
}

async function initializeForecastInWorker() {
  const snapshot = createForecastSnapshot();
  const result = await new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../workers/forecast-initializer.worker.js', import.meta.url), {
      workerData: snapshot,
    });
    forecastWorker = worker;
    worker.once('message', resolve);
    worker.once('error', reject);
    worker.once('exit', code => {
      forecastWorker = null;
      if (code !== 0) reject(new Error('El proceso de pronóstico terminó inesperadamente.'));
    });
  });

  if (!result?.ready) throw new Error('No se pudo inicializar el modelo de pronóstico.');
  await forecastService.initialize();
  return forecastService.getEvaluation();
}

export async function initializeDemoRuntime() {
  const pool = requireMysqlPool();
  console.log('Inicializando el esquema de la base de datos...');
  await databaseInitializer.initialize();
  let seedSummary = { businesses: 0, products: 0, businessProducts: 0, sales: 0, inventoryItems: 0 };
  if (demoModeEnabled) {
    console.log('Importando el catálogo, surtidos, ventas e inventario demo...');
    seedSummary = await demoDataSeeder.seed();
    console.log(
      `Datos demo listos: ${seedSummary.businesses} negocios, ${seedSummary.products} productos y ${seedSummary.sales} ventas${seedSummary.datasetAlreadyLoaded ? ' (carga existente)' : ''}.`,
    );
  }
  console.log('Sincronizando cuentas demo...');
  await authService.initialize();
  console.log('Cargando el historial de ventas...');
  const loadedSales = await salesRepository.load();
  if (demoModeEnabled && loadedSales.sales < seedSummary.sales) {
    throw new Error('MySQL contiene menos ventas que el conjunto de demostración esperado.');
  }
  return {
    ...seedSummary,
    availableBusinesses: salesRepository.getBusinesses().length,
    availableSales: loadedSales.sales,
  };
}

export function initializeForecastRuntime() {
  if (!forecastInitialization) {
    forecastInitialization = initializeForecastInWorker().catch(error => {
      forecastInitialization = null;
      throw error;
    });
  }
  return forecastInitialization;
}

export async function closeDemoRuntime() {
  if (forecastWorker) await forecastWorker.terminate();
  if (mysqlPool) await mysqlPool.end();
}

export const demoServices = Object.freeze({
  authService,
  salesRepository,
  forecastService,
  inventoryService,
  recommendationService,
  explanationService,
  calendarService,
});

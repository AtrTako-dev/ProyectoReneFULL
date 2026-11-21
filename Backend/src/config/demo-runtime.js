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

export async function initializeDemoRuntime() {
  const pool = requireMysqlPool();
  await databaseInitializer.initialize();
  const seedSummary = demoModeEnabled
    ? await demoDataSeeder.seed()
    : { businesses: 0, products: 0, businessProducts: 0, sales: 0, inventoryItems: 0 };
  await authService.initialize();
  const loadedSales = await salesRepository.load();
  if (demoModeEnabled && loadedSales.sales < seedSummary.sales) {
    throw new Error('MySQL contiene menos ventas que el conjunto de demostración esperado.');
  }
  await forecastService.initialize();
  return {
    ...seedSummary,
    availableBusinesses: salesRepository.getBusinesses().length,
    availableSales: loadedSales.sales,
  };
}

export async function closeDemoRuntime() {
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

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BusinessAssortmentImporterService } from './business-assortment-importer.service.js';
import { BusinessImporterService } from './business-importer.service.js';
import { CsvImporterService } from './csv-importer.service.js';
import { ProductCatalogImporterService } from './product-catalog-importer.service.js';
import { WeeklySalesImporterService } from './weekly-sales-importer.service.js';

const DATA_DIRECTORY = fileURLToPath(new URL('../../pulsostock_matriz_soriana_22500_v3/', import.meta.url));
const STORE_FILES = Object.freeze([
  'tienda_1_fruteria_la_huerta_500.csv',
  'tienda_2_panaderia_la_espiga_500.csv',
  'tienda_3_electronica_punto_digital_500.csv',
  'tienda_4_abarrotes_el_puente_500.csv',
  'tienda_5_papel_y_tinta_500.csv',
]);

const CATALOG_FILE = 'catalogo_100_productos.csv';
const ASSORTMENT_FILE = 'surtido_por_negocio.csv';
const BUSINESS_IDS = Object.freeze(['201', '202', '203', '204', '205']);
const EXPECTED_DATASET = Object.freeze({ businesses: 5, products: 100, businessProducts: 50, sales: 2500 });
const businessIdPlaceholders = BUSINESS_IDS.map(() => '?').join(', ');

async function hasCompleteDataset(executor) {
  const [rows] = await executor.execute(
    `SELECT
       (SELECT COUNT(*) FROM businesses
        WHERE id IN (${businessIdPlaceholders}) AND is_reference_only = FALSE) AS business_count,
       (SELECT COUNT(*) FROM products) AS product_count,
       (SELECT COUNT(*) FROM business_products
        WHERE business_id IN (${businessIdPlaceholders})) AS assortment_count,
       (SELECT COUNT(*) FROM weekly_sales
        WHERE business_id IN (${businessIdPlaceholders}) AND data_origin = 'synthetic') AS sales_count`,
    [...BUSINESS_IDS, ...BUSINESS_IDS, ...BUSINESS_IDS],
  );
  const counts = rows[0] ?? {};
  return Number(counts.business_count) >= EXPECTED_DATASET.businesses
    && Number(counts.product_count) >= EXPECTED_DATASET.products
    && Number(counts.assortment_count) >= EXPECTED_DATASET.businessProducts
    && Number(counts.sales_count) >= EXPECTED_DATASET.sales;
}

async function synchronizeSyntheticInventory(executor) {
  await executor.execute(
    `INSERT INTO current_inventory
       (business_id, product_sku, quantity_on_hand, data_origin)
     SELECT latest.business_id, latest.product_sku, latest.closing_stock, 'synthetic'
     FROM weekly_sales latest
     JOIN (
       SELECT business_id, product_sku, MAX(week_start) AS latest_week
       FROM weekly_sales
       WHERE data_origin = 'synthetic' AND business_id IN (${businessIdPlaceholders})
       GROUP BY business_id, product_sku
     ) latest_period
       ON latest_period.business_id = latest.business_id
      AND latest_period.product_sku = latest.product_sku
      AND latest_period.latest_week = latest.week_start
     JOIN business_products assortment
       ON assortment.business_id = latest.business_id
      AND assortment.product_sku = latest.product_sku
     WHERE latest.data_origin = 'synthetic'
     ON DUPLICATE KEY UPDATE
       quantity_on_hand = IF(current_inventory.data_origin = 'synthetic',
         VALUES(quantity_on_hand), current_inventory.quantity_on_hand)`,
    BUSINESS_IDS,
  );
}

export class DemoDataSeeder {
  constructor({ pool, directory = DATA_DIRECTORY, csvImporter = new CsvImporterService() }) {
    this.pool = pool;
    this.directory = directory;
    const storeFiles = STORE_FILES.map(file => path.join(directory, file));
    this.businessImporter = new BusinessImporterService({ csvImporter, storeFiles });
    this.catalogImporter = new ProductCatalogImporterService({ csvImporter });
    this.assortmentImporter = new BusinessAssortmentImporterService({ csvImporter });
    this.salesImporter = new WeeklySalesImporterService({ csvImporter, storeFiles });
  }

  async seed() {
    if (!this.pool) throw new Error('Se requiere una conexión MySQL para importar el conjunto demo.');
    const connection = await this.pool.getConnection();

    try {
      await connection.beginTransaction();
      let summary = { ...EXPECTED_DATASET };
      const datasetAlreadyLoaded = await hasCompleteDataset(connection);
      if (!datasetAlreadyLoaded) {
        const businesses = await this.businessImporter.importFromStoreFiles(connection);
        const products = await this.catalogImporter.import(
          connection,
          path.join(this.directory, CATALOG_FILE),
        );
        const assortment = await this.assortmentImporter.import(
          connection,
          path.join(this.directory, ASSORTMENT_FILE),
          { businesses, products },
        );
        const sales = await this.salesImporter.import(connection, {
          businesses,
          products,
          assortment: assortment.keys,
        });
        summary = {
          businesses: businesses.size,
          products: products.size,
          businessProducts: assortment.pairs.length,
          sales,
        };
      }
      await synchronizeSyntheticInventory(connection);
      await connection.commit();

      return {
        ...summary,
        inventoryItems: EXPECTED_DATASET.businessProducts,
        datasetAlreadyLoaded,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

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
const INVENTORY_BATCH_SIZE = 100;

async function initializeSyntheticInventory(executor, pairs) {
  for (let offset = 0; offset < pairs.length; offset += INVENTORY_BATCH_SIZE) {
    const batch = pairs.slice(offset, offset + INVENTORY_BATCH_SIZE);
    const placeholders = batch.map(() => '(?, ?, ?, ?)').join(', ');
    await executor.execute(
      `INSERT IGNORE INTO current_inventory
         (business_id, product_sku, quantity_on_hand, data_origin)
       VALUES ${placeholders}`,
      batch.flatMap(({ businessId, productId }) => [
        businessId,
        productId,
        businessId === '201' && productId === 'PS001' ? 15 : 0,
        'synthetic',
      ]),
    );
  }
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
      await initializeSyntheticInventory(connection, assortment.pairs);
      await connection.commit();

      return {
        businesses: businesses.size,
        products: products.size,
        businessProducts: assortment.pairs.length,
        sales,
        inventoryItems: assortment.pairs.length,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

import { Product } from '../models/product.model.js';

const CATALOG_COLUMNS = ['producto_id', 'producto', 'marca', 'categoria', 'unidad'];
const BATCH_SIZE = 100;

function productFromRow(record, source, rowNumber) {
  try {
    const product = new Product({
      sku: record.producto_id,
      name: record.producto,
      brand: record.marca?.trim() ?? '',
      category: record.categoria?.trim() ?? '',
      unit: record.unidad,
    });
    if (product.sku.length > 64 || product.name.length > 200
      || product.brand.length > 100 || product.category.length > 100 || product.unit.length > 32) {
      throw new RangeError('El producto excede el tamaño permitido por el catálogo.');
    }
    return product;
  } catch (error) {
    throw new Error(`${source} fila ${rowNumber}: ${error.message}`);
  }
}

async function insertBatch(executor, batch) {
  const placeholders = batch.map(() => '(?, ?, ?, ?, ?)').join(', ');
  const values = batch.flatMap(product => [
    product.sku,
    product.name,
    product.category,
    product.brand,
    product.unit,
  ]);
  await executor.execute(
    `INSERT INTO products (sku, name, category, brand, unit)
     VALUES ${placeholders}
     ON DUPLICATE KEY UPDATE
       name = VALUES(name), category = VALUES(category),
       brand = VALUES(brand), unit = VALUES(unit)`,
    values,
  );
}

export class ProductCatalogImporterService {
  constructor({ csvImporter, batchSize = BATCH_SIZE }) {
    this.csvImporter = csvImporter;
    this.batchSize = batchSize;
  }

  async import(executor, filePath) {
    const source = filePath.split(/[\\/]/).at(-1);
    const products = new Map();
    let batch = [];

    for await (const { rowNumber, record } of this.csvImporter.read(filePath, {
      source,
      requiredColumns: CATALOG_COLUMNS,
    })) {
      const product = productFromRow(record, source, rowNumber);
      if (products.has(product.sku)) {
        throw new Error(`${source} fila ${rowNumber}: el SKU ${product.sku} está repetido.`);
      }
      products.set(product.sku, product);
      batch.push(product);
      if (batch.length === this.batchSize) {
        await insertBatch(executor, batch);
        batch = [];
      }
    }

    if (products.size === 0) throw new Error(`${source}: el catálogo no contiene productos.`);
    if (batch.length > 0) await insertBatch(executor, batch);
    return products;
  }
}

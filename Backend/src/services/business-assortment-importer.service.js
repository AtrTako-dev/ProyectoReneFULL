const ASSORTMENT_COLUMNS = ['negocio_id', 'producto_id'];
const BATCH_SIZE = 100;

async function insertBatch(executor, batch) {
  const placeholders = batch.map(() => '(?, ?)').join(', ');
  await executor.execute(
    `INSERT INTO business_products (business_id, product_sku)
     VALUES ${placeholders}
     ON DUPLICATE KEY UPDATE product_sku = VALUES(product_sku)`,
    batch.flatMap(({ businessId, productId }) => [businessId, productId]),
  );
}

export class BusinessAssortmentImporterService {
  constructor({ csvImporter, batchSize = BATCH_SIZE }) {
    this.csvImporter = csvImporter;
    this.batchSize = batchSize;
  }

  async import(executor, filePath, { businesses, products }) {
    const source = filePath.split(/[\\/]/).at(-1);
    const assortment = new Set();
    const pairs = [];
    const batch = [];

    for await (const { rowNumber, record } of this.csvImporter.read(filePath, {
      source,
      requiredColumns: ASSORTMENT_COLUMNS,
    })) {
      const businessId = record.negocio_id?.trim();
      const productId = record.producto_id?.trim();
      if (!businessId || !productId) {
        throw new Error(`${source} fila ${rowNumber}: se requieren negocio_id y producto_id.`);
      }
      if (!businesses.has(businessId)) {
        throw new Error(`${source} fila ${rowNumber}: el negocio ${businessId} no está en los archivos de tiendas.`);
      }
      if (!products.has(productId)) {
        throw new Error(`${source} fila ${rowNumber}: el SKU ${productId} no existe en el catálogo global.`);
      }

      const key = `${businessId}\u001f${productId}`;
      if (assortment.has(key)) {
        throw new Error(`${source} fila ${rowNumber}: la relación ${businessId}/${productId} está repetida.`);
      }
      assortment.add(key);
      const pair = { businessId, productId };
      pairs.push(pair);
      batch.push(pair);
      if (batch.length === this.batchSize) {
        await insertBatch(executor, batch.splice(0, batch.length));
      }
    }

    if (assortment.size === 0) throw new Error(`${source}: el surtido no contiene productos.`);
    if (batch.length > 0) await insertBatch(executor, batch);
    return { keys: assortment, pairs };
  }
}

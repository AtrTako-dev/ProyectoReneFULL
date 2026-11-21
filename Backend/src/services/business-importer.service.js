const BUSINESS_COLUMNS = ['negocio_id', 'negocio', 'es_referencia_matriz'];

function requiredText(record, column, source, rowNumber) {
  const value = record[column]?.trim();
  if (!value) throw new Error(`${source} fila ${rowNumber}: falta ${column}.`);
  return value;
}

export class BusinessImporterService {
  constructor({ csvImporter, storeFiles }) {
    this.csvImporter = csvImporter;
    this.storeFiles = storeFiles;
  }

  async importFromStoreFiles(executor) {
    const businesses = new Map();

    for (const filePath of this.storeFiles) {
      const source = filePath.split(/[\\/]/).at(-1);
      const { rowNumber, record } = await this.csvImporter.first(filePath, {
        source,
        requiredColumns: BUSINESS_COLUMNS,
      });
      const businessId = requiredText(record, 'negocio_id', source, rowNumber);
      const name = requiredText(record, 'negocio', source, rowNumber);
      const isReferenceMatrix = record.es_referencia_matriz?.trim();

      if (businessId === '900' || isReferenceMatrix !== '0') {
        throw new Error(`${source} fila ${rowNumber}: la matriz de referencia no se importa como negocio operativo.`);
      }
      if (businessId.length > 36 || name.length > 150) {
        throw new Error(`${source} fila ${rowNumber}: el ID o nombre del negocio excede el límite permitido.`);
      }
      if (businesses.has(businessId)) {
        throw new Error(`${source} fila ${rowNumber}: el negocio ${businessId} aparece en más de un archivo de tienda.`);
      }

      const business = { id: businessId, name };
      await executor.execute(
        `INSERT INTO businesses (id, name, is_reference_only)
         VALUES (?, ?, FALSE)
         ON DUPLICATE KEY UPDATE name = VALUES(name), is_reference_only = FALSE`,
        [business.id, business.name],
      );
      businesses.set(businessId, business);
    }

    if (businesses.size !== this.storeFiles.length) {
      throw new Error('Cada archivo de tienda debe identificar un negocio distinto.');
    }
    return businesses;
  }
}

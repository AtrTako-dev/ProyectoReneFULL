const REQUIRED_COLUMNS = [
  'registro_id', 'negocio_id', 'negocio', 'es_referencia_matriz',
  'semana_numero', 'fecha_inicio', 'fecha_fin', 'producto_id', 'producto',
  'marca', 'categoria', 'unidad', 'precio_lista_mxn', 'descuento_pct',
  'precio_unitario_mxn', 'unidades_vendidas', 'ingresos_mxn',
  'costo_unitario_mxn', 'utilidad_bruta_mxn', 'inventario_inicial',
  'reabastecimiento_unidades', 'merma_unidades', 'inventario_final',
  'ventas_semana_anterior', 'es_buen_fin', 'es_black_friday',
  'es_cyber_monday', 'es_navidad', 'es_regreso_clases', 'es_dia_madres',
  'es_promocion',
];

const SALE_COLUMNS = [
  'business_id', 'product_sku', 'week_start', 'week_end', 'week_number',
  'units_sold', 'list_price_mxn', 'discount_percent', 'unit_price_mxn',
  'revenue_mxn', 'unit_cost_mxn', 'gross_profit_mxn', 'opening_stock',
  'replenishment_units', 'shrinkage_units', 'closing_stock',
  'previous_week_sales', 'is_buen_fin', 'is_black_friday', 'is_cyber_monday',
  'is_christmas', 'is_back_to_school', 'is_mothers_day', 'is_promotion',
  'data_origin', 'source_record_id',
];

const STAGING_TABLE = 'tmp_weekly_sales_import';
const BATCH_SIZE = 100;

function requiredText(record, column, source, rowNumber) {
  const value = record[column]?.trim();
  if (!value) throw new Error(`${source} fila ${rowNumber}: falta ${column}.`);
  return value;
}

function numericValue(rawValue, column, source, rowNumber, {
  required = true,
  minimum = null,
  maximum = null,
  precision = null,
  scale = null,
} = {}) {
  const text = rawValue?.trim();
  if (!text && !required) return null;
  const value = Number(text);
  if (!text || !Number.isFinite(value)
    || (minimum !== null && value < minimum)
    || (maximum !== null && value > maximum)) {
    throw new Error(`${source} fila ${rowNumber}: ${column} no contiene un valor válido.`);
  }
  if (precision !== null && scale !== null) {
    try {
      decimalToScaledInteger(text, { precision, scale, label: column });
    } catch (error) {
      throw new Error(`${source} fila ${rowNumber}: ${error.message}`);
    }
  }
  return value;
}

function dateValue(rawValue, column, source, rowNumber) {
  const value = requiredText({ [column]: rawValue }, column, source, rowNumber);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${source} fila ${rowNumber}: ${column} debe usar AAAA-MM-DD.`);
  }
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) {
    throw new Error(`${source} fila ${rowNumber}: ${column} no es una fecha válida.`);
  }
  return { value, timestamp };
}

function booleanValue(rawValue, column, source, rowNumber) {
  const value = rawValue?.trim();
  if (value !== '0' && value !== '1') {
    throw new Error(`${source} fila ${rowNumber}: ${column} debe ser 0 o 1.`);
  }
  return value === '1' ? 1 : 0;
}

function seriesKey(businessId, productId) {
  return `${businessId}\u001f${productId}`;
}

function recordFromCsv(record, rowNumber, source, { businesses, products, assortment }) {
  const sourceRecordId = requiredText(record, 'registro_id', source, rowNumber);
  const businessId = requiredText(record, 'negocio_id', source, rowNumber);
  const businessName = requiredText(record, 'negocio', source, rowNumber);
  const productId = requiredText(record, 'producto_id', source, rowNumber);
  const isReferenceMatrix = record.es_referencia_matriz?.trim();
  const business = businesses.get(businessId);
  const product = products.get(productId);

  if (businessId === '900' || isReferenceMatrix !== '0' || !business) {
    throw new Error(`${source} fila ${rowNumber}: la matriz o un negocio no autorizado no se puede importar.`);
  }
  if (business.name !== businessName) {
    throw new Error(`${source} fila ${rowNumber}: el nombre del negocio no coincide con el archivo de tienda.`);
  }
  if (!product) throw new Error(`${source} fila ${rowNumber}: el SKU ${productId} no existe en el catálogo global.`);
  if (!assortment.has(seriesKey(businessId, productId))) {
    throw new Error(`${source} fila ${rowNumber}: el SKU ${productId} no pertenece al surtido de ${businessId}.`);
  }
  if (product.name !== record.producto?.trim()
    || product.brand !== record.marca?.trim()
    || product.category !== record.categoria?.trim()
    || product.unit !== record.unidad?.trim()) {
    throw new Error(`${source} fila ${rowNumber}: los datos de ${productId} no coinciden con el catálogo global.`);
  }
  if (sourceRecordId.length > 64) {
    throw new Error(`${source} fila ${rowNumber}: registro_id excede 64 caracteres.`);
  }

  const start = dateValue(record.fecha_inicio, 'fecha_inicio', source, rowNumber);
  const end = dateValue(record.fecha_fin, 'fecha_fin', source, rowNumber);
  const expectedEnd = start.timestamp + (6 * 24 * 60 * 60 * 1000);
  if (new Date(start.timestamp).getUTCDay() !== 1 || expectedEnd !== end.timestamp) {
    throw new Error(`${source} fila ${rowNumber}: la venta debe cubrir una semana de lunes a domingo.`);
  }

  const weekNumber = numericValue(record.semana_numero, 'semana_numero', source, rowNumber, {
    minimum: 1,
    maximum: 65535,
  });
  if (!Number.isSafeInteger(weekNumber)) {
    throw new Error(`${source} fila ${rowNumber}: semana_numero debe ser entero.`);
  }

  const positiveAmounts = [
    ['unidades_vendidas', 'unitsSold', 14, 3],
    ['precio_lista_mxn', 'listPrice', 14, 2],
    ['precio_unitario_mxn', 'unitPrice', 14, 2],
    ['ingresos_mxn', 'revenue', 16, 2],
    ['costo_unitario_mxn', 'unitCost', 14, 2],
    ['inventario_inicial', 'openingStock', 14, 3],
    ['reabastecimiento_unidades', 'replenishment', 14, 3],
    ['merma_unidades', 'shrinkage', 14, 3],
    ['inventario_final', 'closingStock', 14, 3],
  ];
  const values = Object.fromEntries(positiveAmounts.map(([column, key, precision, scale]) => [
    key,
    numericValue(record[column], column, source, rowNumber, { minimum: 0, precision, scale }),
  ]));
  values.grossProfit = numericValue(record.utilidad_bruta_mxn, 'utilidad_bruta_mxn', source, rowNumber, {
    precision: 16,
    scale: 2,
  });
  values.discount = numericValue(record.descuento_pct, 'descuento_pct', source, rowNumber, {
    minimum: 0,
    maximum: 100,
    precision: 6,
    scale: 3,
  });
  values.previousSales = numericValue(record.ventas_semana_anterior, 'ventas_semana_anterior', source, rowNumber, {
    required: false,
    minimum: 0,
    precision: 14,
    scale: 3,
  });
  const flags = [
    ['es_buen_fin', 'buenFin'],
    ['es_black_friday', 'blackFriday'],
    ['es_cyber_monday', 'cyberMonday'],
    ['es_navidad', 'christmas'],
    ['es_regreso_clases', 'backToSchool'],
    ['es_dia_madres', 'mothersDay'],
    ['es_promocion', 'promotion'],
  ];
  for (const [column, key] of flags) values[key] = booleanValue(record[column], column, source, rowNumber);

  return {
    values: [
      businessId,
      productId,
      start.value,
      end.value,
      weekNumber,
      values.unitsSold,
      values.listPrice,
      values.discount,
      values.unitPrice,
      values.revenue,
      values.unitCost,
      values.grossProfit,
      values.openingStock,
      values.replenishment,
      values.shrinkage,
      values.closingStock,
      values.previousSales,
      values.buenFin,
      values.blackFriday,
      values.cyberMonday,
      values.christmas,
      values.backToSchool,
      values.mothersDay,
      values.promotion,
      'synthetic',
      sourceRecordId,
    ],
    rowNumber,
  };
}

function stagingDefinition() {
  return `CREATE TEMPORARY TABLE ${STAGING_TABLE} (
    business_id VARCHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    product_sku VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    week_start DATE NOT NULL,
    week_end DATE NOT NULL,
    week_number SMALLINT UNSIGNED NOT NULL,
    units_sold DECIMAL(14, 3) NOT NULL,
    list_price_mxn DECIMAL(14, 2) NULL,
    discount_percent DECIMAL(6, 3) NULL,
    unit_price_mxn DECIMAL(14, 2) NULL,
    revenue_mxn DECIMAL(16, 2) NULL,
    unit_cost_mxn DECIMAL(14, 2) NULL,
    gross_profit_mxn DECIMAL(16, 2) NULL,
    opening_stock DECIMAL(14, 3) NULL,
    replenishment_units DECIMAL(14, 3) NULL,
    shrinkage_units DECIMAL(14, 3) NULL,
    closing_stock DECIMAL(14, 3) NULL,
    previous_week_sales DECIMAL(14, 3) NULL,
    is_buen_fin BOOLEAN NOT NULL,
    is_black_friday BOOLEAN NOT NULL,
    is_cyber_monday BOOLEAN NOT NULL,
    is_christmas BOOLEAN NOT NULL,
    is_back_to_school BOOLEAN NOT NULL,
    is_mothers_day BOOLEAN NOT NULL,
    is_promotion BOOLEAN NOT NULL,
    data_origin ENUM('synthetic', 'operational') NOT NULL,
    source_record_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    source_line INT UNSIGNED NOT NULL,
    PRIMARY KEY (business_id, product_sku, week_start),
    UNIQUE KEY uq_tmp_weekly_sales_source (source_record_id)
  ) ENGINE = InnoDB`;
}

async function insertBatch(executor, batch, source) {
  const columns = [...SALE_COLUMNS, 'source_line'];
  const placeholders = batch.map(() => `(${columns.map(() => '?').join(', ')})`).join(', ');
  const values = batch.flatMap(item => [...item.values, item.rowNumber]);
  try {
    await executor.execute(
      `INSERT INTO ${STAGING_TABLE} (${columns.join(', ')}) VALUES ${placeholders}`,
      values,
    );
  } catch (error) {
    if (error.code !== 'ER_DUP_ENTRY') throw error;
    for (const item of batch) {
      try {
        await executor.execute(
          `INSERT INTO ${STAGING_TABLE} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
          [...item.values, item.rowNumber],
        );
      } catch (rowError) {
        if (rowError.code === 'ER_DUP_ENTRY') {
          throw new Error(`${source} fila ${item.rowNumber}: la semana o registro_id ya está repetido.`);
        }
        throw rowError;
      }
    }
  }
}

async function mergeIntoSales(executor) {
  const columns = SALE_COLUMNS.join(', ');
  const mutableColumns = SALE_COLUMNS.filter(column => ![
    'business_id', 'product_sku', 'week_start', 'data_origin',
  ].includes(column));
  const updates = mutableColumns.map(column => (
    `${column} = IF(weekly_sales.data_origin = 'synthetic', VALUES(${column}), weekly_sales.${column})`
  ));
  updates.push("data_origin = IF(weekly_sales.data_origin = 'synthetic', VALUES(data_origin), weekly_sales.data_origin)");
  await executor.execute(
    `INSERT INTO weekly_sales (${columns})
     SELECT ${columns} FROM ${STAGING_TABLE}
     ORDER BY business_id, product_sku, week_start
     ON DUPLICATE KEY UPDATE ${updates.join(', ')}`,
  );
}

async function ensureSourceIdsMatch(executor) {
  const [collisions] = await executor.execute(
    `SELECT staged.source_record_id, staged.source_line
     FROM ${STAGING_TABLE} staged
     JOIN weekly_sales existing
       ON existing.source_record_id = staged.source_record_id
     WHERE existing.business_id <> staged.business_id
        OR existing.product_sku <> staged.product_sku
        OR existing.week_start <> staged.week_start
     LIMIT 1`,
  );
  if (collisions.length > 0) {
    const { source_record_id: sourceRecordId, source_line: rowNumber } = collisions[0];
    throw new Error(`La fila ${rowNumber} usa el registro_id ${sourceRecordId}, que ya pertenece a otra venta.`);
  }
}

export class WeeklySalesImporterService {
  constructor({ csvImporter, storeFiles, batchSize = BATCH_SIZE }) {
    this.csvImporter = csvImporter;
    this.storeFiles = storeFiles;
    this.batchSize = batchSize;
  }

  async import(executor, { businesses, products, assortment }) {
    await executor.query(`DROP TEMPORARY TABLE IF EXISTS ${STAGING_TABLE}`);
    await executor.query(stagingDefinition());
    let importedRows = 0;

    try {
      for (const filePath of this.storeFiles) {
        const source = filePath.split(/[\\/]/).at(-1);
        let batch = [];
        for await (const { rowNumber, record } of this.csvImporter.read(filePath, {
          source,
          requiredColumns: REQUIRED_COLUMNS,
        })) {
          batch.push(recordFromCsv(record, rowNumber, source, { businesses, products, assortment }));
          if (batch.length === this.batchSize) {
            await insertBatch(executor, batch, source);
            importedRows += batch.length;
            batch = [];
          }
        }
        if (batch.length > 0) {
          await insertBatch(executor, batch, source);
          importedRows += batch.length;
        }
      }

      await ensureSourceIdsMatch(executor);
      await mergeIntoSales(executor);
      return importedRows;
    } finally {
      await executor.query(`DROP TEMPORARY TABLE IF EXISTS ${STAGING_TABLE}`);
    }
  }
}
import { decimalToScaledInteger } from '../utils/decimal.js';


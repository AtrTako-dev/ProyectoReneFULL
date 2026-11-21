import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsvObjects } from '../utils/csv-reader.js';

const repositoryDirectory = path.dirname(fileURLToPath(import.meta.url));
const dataDirectory = path.resolve(repositoryDirectory, '../../pulsostock_matriz_soriana_22500_v3');

const STORE_CSV_FILES = Object.freeze([
  'tienda_1_fruteria_la_huerta_500.csv',
  'tienda_2_panaderia_la_espiga_500.csv',
  'tienda_3_electronica_punto_digital_500.csv',
  'tienda_4_abarrotes_el_puente_500.csv',
  'tienda_5_papel_y_tinta_500.csv',
]);

function requiredText(row, field, source) {
  const value = row[field]?.trim();
  if (!value) throw new Error(`${source} is missing ${field}`);
  return value;
}

function requiredNumber(row, field, source) {
  const value = Number(row[field]);
  if (!Number.isFinite(value)) throw new Error(`${source} has an invalid ${field}`);
  return value;
}

function businessIdOf(value) {
  return String(value ?? '');
}

function compareIds(left, right) {
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) return leftNumber - rightNumber;
  return left.localeCompare(right);
}

export class SalesCsvRepository {
  constructor({ directory = dataDirectory, files = STORE_CSV_FILES } = {}) {
    this.businesses = new Map();
    this.products = new Map();
    this.series = new Map();

    for (const file of files) {
      const sourcePath = path.join(directory, file);
      const records = parseCsvObjects(fs.readFileSync(sourcePath, 'utf8'), { source: file });
      if (records.length === 0) throw new Error(`${file} contains no sales records`);

      const businessIdsInFile = new Set();
      records.forEach((record, index) => {
        const source = `${file} row ${index + 2}`;
        const businessId = requiredText(record, 'negocio_id', source);
        const businessName = requiredText(record, 'negocio', source);
        const productId = requiredText(record, 'producto_id', source);
        const productName = requiredText(record, 'producto', source);
        const unit = requiredText(record, 'unidad', source);
        const startDate = requiredText(record, 'fecha_inicio', source);
        const endDate = requiredText(record, 'fecha_fin', source);
        const startTimestamp = Date.parse(`${startDate}T00:00:00Z`);
        if (!Number.isFinite(startTimestamp)) throw new Error(`${source} has an invalid fecha_inicio`);
        const unitsSold = requiredNumber(record, 'unidades_vendidas', source);

        businessIdsInFile.add(businessId);
        const business = this.businesses.get(businessId);
        if (business && business.businessName !== businessName) {
          throw new Error(`Business ${businessId} has inconsistent names`);
        }
        this.businesses.set(businessId, { businessId, businessName });

        const seriesKey = this.#seriesKey(businessId, productId);
        const existingProduct = this.products.get(seriesKey);
        if (existingProduct && (existingProduct.productName !== productName || existingProduct.unit !== unit)) {
          throw new Error(`Product ${productId} has inconsistent metadata for business ${businessId}`);
        }
        if (!existingProduct) {
          this.products.set(seriesKey, {
            businessId,
            productId,
            productName,
            brand: record.marca?.trim() ?? '',
            category: record.categoria?.trim() ?? '',
            unit,
          });
          this.series.set(seriesKey, []);
        }

        this.series.get(seriesKey).push({
          businessId,
          productId,
          weekNumber: requiredNumber(record, 'semana_numero', source),
          startDate,
          endDate,
          unitsSold,
          _startTimestamp: startTimestamp,
        });
      });

      if (businessIdsInFile.size !== 1) {
        throw new Error(`${file} must contain data for exactly one business`);
      }
    }

    for (const records of this.series.values()) {
      records.sort((left, right) => left._startTimestamp - right._startTimestamp);
      for (let index = 1; index < records.length; index += 1) {
        if (records[index - 1]._startTimestamp === records[index]._startTimestamp) {
          throw new Error(
            `Duplicate week for business ${records[index].businessId}, product ${records[index].productId}`,
          );
        }
      }
      records.forEach((record) => delete record._startTimestamp);
    }
  }

  #seriesKey(businessId, productId) {
    return `${businessIdOf(businessId)}\u001f${String(productId ?? '')}`;
  }

  getBusinesses() {
    return [...this.businesses.values()]
      .sort((left, right) => compareIds(left.businessId, right.businessId))
      .map((business) => ({ ...business }));
  }

  getBusiness(businessId) {
    const business = this.businesses.get(businessIdOf(businessId));
    return business ? { ...business } : null;
  }

  getProducts(businessId) {
    const normalizedBusinessId = businessIdOf(businessId);
    return [...this.products.values()]
      .filter((product) => product.businessId === normalizedBusinessId)
      .sort((left, right) => left.productId.localeCompare(right.productId))
      .map((product) => ({ ...product }));
  }

  getProduct(businessId, productId) {
    const product = this.products.get(this.#seriesKey(businessId, productId));
    return product ? { ...product } : null;
  }

  getSales(businessId, productId) {
    const hasBusinessId = businessId !== undefined && businessId !== null;
    const hasProductId = productId !== undefined && productId !== null;
    const sales = [];

    for (const records of this.series.values()) {
      for (const record of records) {
        if (hasBusinessId && record.businessId !== businessIdOf(businessId)) continue;
        if (hasProductId && record.productId !== String(productId)) continue;
        sales.push({ ...record });
      }
    }

    return sales.sort((left, right) => (
      compareIds(left.businessId, right.businessId)
      || left.productId.localeCompare(right.productId)
      || left.startDate.localeCompare(right.startDate)
    ));
  }

  getSeries(businessId, productId) {
    const records = this.series.get(this.#seriesKey(businessId, productId)) ?? [];
    return records.map((record) => ({ ...record }));
  }
}

export const salesRepository = new SalesCsvRepository();

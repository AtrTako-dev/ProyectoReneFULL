function seriesKey(businessId, productId) {
  return `${String(businessId)}\u001f${String(productId)}`;
}

function dateOnly(value) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function compareIds(left, right) {
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) return leftNumber - rightNumber;
  return left.localeCompare(right);
}

export class MySqlSalesRepository {
  constructor(pool) {
    this.pool = pool;
    this.businesses = new Map();
    this.products = new Map();
    this.series = new Map();
    this.loaded = false;
  }

  async load() {
    if (!this.pool) throw new Error('Configura MySQL para cargar las ventas del repositorio.');
    const [businessRows] = await this.pool.execute(
      `SELECT id, name FROM businesses
       WHERE is_reference_only = FALSE ORDER BY name`,
    );
    const [productRows] = await this.pool.execute(
      `SELECT bp.business_id, p.sku, p.name, p.brand, p.category, p.unit
       FROM business_products bp
       JOIN products p ON p.sku = bp.product_sku
       JOIN businesses b ON b.id = bp.business_id
       WHERE b.is_reference_only = FALSE
       ORDER BY bp.business_id, p.sku`,
    );
    const [salesRows] = await this.pool.execute(
      `SELECT business_id, product_sku, week_number, week_start, week_end, units_sold, data_origin
       FROM weekly_sales
       WHERE data_origin IN ('synthetic', 'operational')
       ORDER BY business_id, product_sku, week_start`,
    );

    this.businesses = new Map(businessRows.map(row => [String(row.id), {
      businessId: String(row.id),
      businessName: row.name,
    }]));
    this.products = new Map();
    this.series = new Map();

    for (const row of productRows) {
      const businessId = String(row.business_id);
      const productId = String(row.sku);
      const key = seriesKey(businessId, productId);
      this.products.set(key, {
        businessId,
        productId,
        productName: row.name,
        brand: row.brand,
        category: row.category,
        unit: row.unit,
      });
      this.series.set(key, []);
    }

    for (const row of salesRows) {
      const businessId = String(row.business_id);
      const productId = String(row.product_sku);
      const key = seriesKey(businessId, productId);
      if (!this.series.has(key)) continue;
      this.series.get(key).push({
        businessId,
        productId,
        weekNumber: Number(row.week_number),
        startDate: dateOnly(row.week_start),
        endDate: dateOnly(row.week_end),
        unitsSold: Number(row.units_sold),
        dataOrigin: row.data_origin,
      });
    }

    this.loaded = true;
    return {
      businesses: this.businesses.size,
      products: this.products.size,
      sales: salesRows.length,
    };
  }

  #ensureLoaded() {
    if (!this.loaded) throw new Error('El repositorio de ventas de MySQL no se ha cargado.');
  }

  getBusinesses() {
    this.#ensureLoaded();
    return [...this.businesses.values()]
      .sort((left, right) => compareIds(left.businessId, right.businessId))
      .map(business => ({ ...business }));
  }

  getBusiness(businessId) {
    this.#ensureLoaded();
    const business = this.businesses.get(String(businessId ?? ''));
    return business ? { ...business } : null;
  }

  getProducts(businessId) {
    this.#ensureLoaded();
    const normalizedBusinessId = String(businessId ?? '');
    return [...this.products.values()]
      .filter(product => product.businessId === normalizedBusinessId)
      .sort((left, right) => left.productId.localeCompare(right.productId))
      .map(product => ({ ...product }));
  }

  getProduct(businessId, productId) {
    this.#ensureLoaded();
    const product = this.products.get(seriesKey(businessId, productId));
    return product ? { ...product } : null;
  }

  getSales(businessId, productId) {
    this.#ensureLoaded();
    const hasBusinessId = businessId !== undefined && businessId !== null;
    const hasProductId = productId !== undefined && productId !== null;
    const sales = [];

    for (const records of this.series.values()) {
      for (const record of records) {
        if (hasBusinessId && record.businessId !== String(businessId)) continue;
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
    this.#ensureLoaded();
    const records = this.series.get(seriesKey(businessId, productId)) ?? [];
    return records.map(record => ({ ...record }));
  }
}

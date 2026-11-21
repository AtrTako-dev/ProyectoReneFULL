import { DomainError } from '../errors/domain-error.js';

export class Product {
  constructor({
    id,
    sku,
    productId,
    product_id,
    producto_id,
    name,
    productName,
    producto,
    category,
    categoria,
    brand,
    marca,
    unit,
    unidad,
  } = {}) {
    const productSku = sku ?? id ?? productId ?? product_id ?? producto_id;
    const productLabel = name ?? productName ?? producto;
    const productUnit = unit ?? unidad;

    if (typeof productSku !== 'string' || productSku.trim() === '') {
      throw new DomainError('El identificador del producto es obligatorio.', {
        code: 'INVALID_PRODUCT_ID',
      });
    }
    if (typeof productLabel !== 'string' || productLabel.trim() === '') {
      throw new DomainError('El nombre del producto es obligatorio.', {
        code: 'INVALID_PRODUCT_NAME',
      });
    }
    if (typeof productUnit !== 'string' || productUnit.trim() === '') {
      throw new DomainError('La unidad del producto es obligatoria.', {
        code: 'INVALID_PRODUCT_UNIT',
      });
    }

    this.id = productSku.trim();
    this.sku = this.id;
    this.productId = this.id;
    this.name = productLabel.trim();
    this.productName = this.name;
    this.category = category ?? categoria ?? '';
    this.brand = brand ?? marca ?? '';
    this.unit = productUnit.trim();
    Object.freeze(this);
  }
}

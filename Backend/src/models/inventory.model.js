import { DomainError } from '../errors/domain-error.js';
import { Product } from './product.model.js';
import { decimalToScaledInteger, scaledIntegerToNumber } from '../utils/decimal.js';

function validateQuantity(quantity) {
  let scaledQuantity;
  try {
    scaledQuantity = decimalToScaledInteger(quantity, {
      precision: 14,
      scale: 3,
      label: 'La cantidad de inventario',
    });
  } catch (error) {
    throw new DomainError(error.message, { code: 'INVALID_QUANTITY' });
  }
  if (scaledQuantity < 0n) {
    throw new DomainError('La cantidad debe ser un número finito mayor o igual a cero.', {
      code: 'INVALID_QUANTITY',
    });
  }
  return scaledIntegerToNumber(scaledQuantity, 3);
}

export class Inventory {
  constructor({
    businessId,
    businessName,
    product,
    quantity,
    unit,
    isSynthetic = false,
    sourceLabel = null,
  } = {}) {
    const productModel = product instanceof Product ? product : new Product(product);
    const inventoryUnit = unit ?? productModel.unit;

    const normalizedQuantity = validateQuantity(quantity);
    if (inventoryUnit !== productModel.unit) {
      throw new DomainError('La unidad debe coincidir exactamente con la del producto.', {
        code: 'UNIT_MISMATCH',
      });
    }

    this.businessId = businessId;
    this.businessName = businessName;
    this.product = productModel;
    this.productId = productModel.id;
    this.quantity = normalizedQuantity;
    this.unit = inventoryUnit;
    this.isSynthetic = Boolean(isSynthetic);
    this.sourceLabel = sourceLabel;
    Object.freeze(this);
  }
}

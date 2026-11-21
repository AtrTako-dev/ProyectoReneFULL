import { DomainError } from '../errors/domain-error.js';
import { decimalToScaledInteger, scaledIntegerToNumber } from '../utils/decimal.js';

export const INVENTORY_MOVEMENT_TYPES = Object.freeze([
  'purchase',
  'sale',
  'shrinkage',
  'adjustment',
]);

export class InventoryMovement {
  constructor({
    id = null,
    businessId,
    productId,
    userId = null,
    userEmail = null,
    type,
    quantityDelta,
    unit,
    note = null,
    createdAt = new Date(),
  } = {}) {
    if (!INVENTORY_MOVEMENT_TYPES.includes(type)) {
      throw new DomainError('El tipo de movimiento de inventario no es válido.', {
        code: 'INVALID_MOVEMENT_TYPE',
      });
    }
    let scaledDelta;
    try {
      scaledDelta = decimalToScaledInteger(quantityDelta, {
        precision: 14,
        scale: 3,
        label: 'El movimiento de inventario',
      });
    } catch (error) {
      throw new DomainError(error.message, { code: 'INVALID_MOVEMENT_QUANTITY' });
    }
    if (scaledDelta === 0n) {
      throw new DomainError('El movimiento debe cambiar el inventario en una cantidad válida.', {
        code: 'INVALID_MOVEMENT_QUANTITY',
      });
    }
    if (typeof unit !== 'string' || unit.trim() === '' || unit.length > 32) {
      throw new DomainError('La unidad del movimiento no es válida.', { code: 'INVALID_MOVEMENT_UNIT' });
    }
    if (note !== null && (typeof note !== 'string' || note.length > 255)) {
      throw new DomainError('La nota del movimiento no puede superar 255 caracteres.', {
        code: 'INVALID_MOVEMENT_NOTE',
      });
    }

    this.id = id === null ? null : String(id);
    this.businessId = String(businessId);
    this.productId = String(productId);
    this.userId = userId === null ? null : String(userId);
    this.userEmail = userEmail;
    this.type = type;
    this.quantityDelta = scaledIntegerToNumber(scaledDelta, 3);
    this.unit = unit.trim();
    this.note = note?.trim() || null;
    this.createdAt = new Date(createdAt).toISOString();
    Object.freeze(this);
  }

  toPublicObject() {
    return {
      id: this.id,
      businessId: this.businessId,
      productId: this.productId,
      userId: this.userId,
      userEmail: this.userEmail,
      type: this.type,
      quantityDelta: this.quantityDelta,
      unit: this.unit,
      note: this.note,
      createdAt: this.createdAt,
    };
  }
}

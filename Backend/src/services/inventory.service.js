import { DomainError } from '../errors/domain-error.js';
import { Inventory } from '../models/inventory.model.js';
import { INVENTORY_MOVEMENT_TYPES, InventoryMovement } from '../models/inventory-movement.model.js';
import {
  decimalToScaledInteger,
  scaledIntegerToDecimal,
  scaledIntegerToNumber,
} from '../utils/decimal.js';

export const SYNTHETIC_INVENTORY_LABEL = 'Inventario inicial sintético de demostración';
export const OPERATIONAL_INVENTORY_LABEL = 'Inventario registrado en More Stock';

function productIdOf(product) {
  if (typeof product === 'string' || typeof product === 'number') return String(product);
  if (product && typeof product === 'object') {
    const id = product.id ?? product.sku ?? product.productId ?? product.product_id ?? product.producto_id;
    if (id !== undefined && id !== null) return String(id);
  }
  throw new DomainError('Se requiere un producto válido.', { code: 'INVALID_PRODUCT_ID' });
}

function toInventory(row) {
  const isSynthetic = row.data_origin === 'synthetic';
  return new Inventory({
    businessId: String(row.business_id),
    businessName: row.business_name,
    product: {
      sku: row.product_sku,
      name: row.product_name,
      category: row.category,
      brand: row.brand,
      unit: row.unit,
    },
    quantity: Number(row.quantity_on_hand),
    unit: row.unit,
    isSynthetic,
    sourceLabel: isSynthetic ? SYNTHETIC_INVENTORY_LABEL : OPERATIONAL_INVENTORY_LABEL,
  });
}

const inventorySelect = `
  SELECT bp.business_id, b.name AS business_name, p.sku AS product_sku,
         p.name AS product_name, p.category, p.brand, p.unit,
         COALESCE(i.quantity_on_hand, 0) AS quantity_on_hand,
         COALESCE(i.data_origin, 'synthetic') AS data_origin
  FROM business_products bp
  JOIN businesses b ON b.id = bp.business_id
  JOIN products p ON p.sku = bp.product_sku
  LEFT JOIN current_inventory i
    ON i.business_id = bp.business_id AND i.product_sku = bp.product_sku`;

function normalizeMovement({ type, quantity, unit, note, userId }) {
  if (!INVENTORY_MOVEMENT_TYPES.includes(type)) {
    throw new DomainError('El tipo debe ser purchase, sale, shrinkage o adjustment.', {
      code: 'INVALID_MOVEMENT_TYPE',
    });
  }
  let quantityMilli;
  try {
    quantityMilli = decimalToScaledInteger(quantity, {
      precision: 14,
      scale: 3,
      label: 'La cantidad del movimiento',
    });
  } catch (error) {
    throw new DomainError(error.message, { code: 'INVALID_MOVEMENT_QUANTITY' });
  }
  if (quantityMilli === 0n) {
    throw new DomainError('La cantidad del movimiento debe ser distinta de cero.', {
      code: 'INVALID_MOVEMENT_QUANTITY',
    });
  }
  if (type !== 'adjustment' && quantityMilli < 0n) {
    throw new DomainError('La cantidad de compra, venta o merma debe ser positiva.', {
      code: 'INVALID_MOVEMENT_QUANTITY',
    });
  }
  if (note !== undefined && note !== null && typeof note !== 'string') {
    throw new DomainError('La nota del movimiento debe ser texto.', { code: 'INVALID_MOVEMENT_NOTE' });
  }
  if (note?.length > 255) {
    throw new DomainError('La nota del movimiento no puede superar 255 caracteres.', {
      code: 'INVALID_MOVEMENT_NOTE',
    });
  }
  if (typeof unit !== 'string' || unit.trim() === '') {
    throw new DomainError('La unidad debe ser texto.', { code: 'UNIT_MISMATCH' });
  }
  return {
    type,
    quantityDeltaMilli: type === 'purchase' ? quantityMilli
      : type === 'adjustment' ? quantityMilli
        : -quantityMilli,
    unit,
    note: note?.trim() || null,
    userId: userId === undefined || userId === null ? null : String(userId),
  };
}

function toMovement(row) {
  return new InventoryMovement({
    id: row.id,
    businessId: row.business_id,
    productId: row.product_sku,
    userId: row.user_id,
    userEmail: row.user_email,
    type: row.movement_type,
    quantityDelta: Number(row.quantity_delta),
    unit: row.unit,
    note: row.note,
    createdAt: row.created_at,
  });
}

export class InventoryService {
  constructor(pool) {
    this.pool = pool;
  }

  #requirePool() {
    if (!this.pool) {
      throw new DomainError('Configura MySQL para consultar o actualizar el inventario.', {
        status: 503,
        code: 'DATABASE_NOT_CONFIGURED',
      });
    }
    return this.pool;
  }

  async get(businessId, product) {
    const productId = productIdOf(product);
    const [rows] = await this.#requirePool().execute(
      `${inventorySelect} WHERE bp.business_id = ? AND bp.product_sku = ? LIMIT 1`,
      [String(businessId), productId],
    );
    if (rows.length === 0) {
      throw new DomainError('El producto no pertenece al surtido de este negocio.', {
        status: 404,
        code: 'PRODUCT_NOT_IN_ASSORTMENT',
      });
    }
    return toInventory(rows[0]);
  }

  async list(businessId, products) {
    if (products !== undefined && !Array.isArray(products)) {
      throw new DomainError('La lista de productos debe ser un arreglo.', { code: 'INVALID_PRODUCT_LIST' });
    }

    const productIds = products?.length ? [...new Set(products.map(productIdOf))] : null;
    if (Array.isArray(products) && products.length === 0) return [];

    const whereProduct = productIds ? ` AND bp.product_sku IN (${productIds.map(() => '?').join(', ')})` : '';
    const values = [String(businessId), ...(productIds ?? [])];
    const [rows] = await this.#requirePool().execute(
      `${inventorySelect} WHERE bp.business_id = ?${whereProduct} ORDER BY p.sku`,
      values,
    );
    return rows.map(toInventory);
  }

  async update(businessId, product, { quantity, unit, note, userId } = {}) {
    let targetQuantityMilli;
    try {
      targetQuantityMilli = decimalToScaledInteger(quantity, {
        precision: 14,
        scale: 3,
        label: 'La cantidad de inventario',
      });
    } catch (error) {
      throw new DomainError(error.message, { code: 'INVALID_QUANTITY' });
    }
    if (targetQuantityMilli < 0n) {
      throw new DomainError('La cantidad debe ser un número finito mayor o igual a cero.', {
        code: 'INVALID_QUANTITY',
      });
    }
    if (typeof unit !== 'string' || unit.trim() === '') {
      throw new DomainError('La unidad debe coincidir exactamente con la del catálogo.', {
        code: 'UNIT_MISMATCH',
      });
    }
    if (note !== undefined && note !== null && typeof note !== 'string') {
      throw new DomainError('La nota del movimiento debe ser texto.', { code: 'INVALID_MOVEMENT_NOTE' });
    }
    if (note?.length > 255) {
      throw new DomainError('La nota del movimiento no puede superar 255 caracteres.', {
        code: 'INVALID_MOVEMENT_NOTE',
      });
    }
    const result = await this.#applyChange(businessId, productIdOf(product), {
      targetQuantityMilli,
      unit,
      note,
      userId,
      type: 'adjustment',
    });
    return result.inventory;
  }

  async createMovement(businessId, product, movementInput = {}) {
    const movement = normalizeMovement(movementInput);
    return this.#applyChange(businessId, productIdOf(product), movement);
  }

  async #applyChange(businessId, productId, change) {
    const pool = this.#requirePool();
    const normalizedBusinessId = String(businessId);
    const connection = await pool.getConnection();
    let movement = null;

    try {
      await connection.beginTransaction();
      const [products] = await connection.execute(
        `SELECT p.unit
         FROM business_products bp
         JOIN products p ON p.sku = bp.product_sku
         WHERE bp.business_id = ? AND bp.product_sku = ? LIMIT 1`,
        [normalizedBusinessId, productId],
      );
      if (products.length === 0) {
        throw new DomainError('El producto no pertenece al surtido de este negocio.', {
          status: 404,
          code: 'PRODUCT_NOT_IN_ASSORTMENT',
        });
      }
      const productUnit = products[0].unit;
      if (change.unit !== undefined && change.unit !== productUnit) {
        throw new DomainError('La unidad debe coincidir exactamente con la del catálogo.', {
          code: 'UNIT_MISMATCH',
        });
      }

      await connection.execute(
        `INSERT IGNORE INTO current_inventory
           (business_id, product_sku, quantity_on_hand, data_origin)
         VALUES (?, ?, 0, 'synthetic')`,
        [normalizedBusinessId, productId],
      );
      const [inventoryRows] = await connection.execute(
        `SELECT quantity_on_hand FROM current_inventory
         WHERE business_id = ? AND product_sku = ? FOR UPDATE`,
        [normalizedBusinessId, productId],
      );
      let currentQuantityMilli;
      try {
        currentQuantityMilli = decimalToScaledInteger(Number(inventoryRows[0].quantity_on_hand), {
          precision: 14,
          scale: 3,
          label: 'El saldo actual',
        });
      } catch (error) {
        throw new DomainError(error.message, { status: 500, code: 'INVALID_STORED_INVENTORY' });
      }
      const quantityDeltaMilli = change.targetQuantityMilli === undefined
        ? change.quantityDeltaMilli
        : change.targetQuantityMilli - currentQuantityMilli;
      const nextQuantityMilli = currentQuantityMilli + quantityDeltaMilli;

      if (nextQuantityMilli < 0n) {
        throw new DomainError('El movimiento no puede dejar el inventario en una cantidad negativa.', {
          status: 409,
          code: 'INSUFFICIENT_INVENTORY',
        });
      }

      let nextQuantity;
      try {
        nextQuantity = scaledIntegerToDecimal(nextQuantityMilli, 3);
        decimalToScaledInteger(nextQuantity, { precision: 14, scale: 3, label: 'El saldo resultante' });
      } catch (error) {
        throw new DomainError(error.message, { code: 'INVALID_QUANTITY' });
      }

      await connection.execute(
        `UPDATE current_inventory
         SET quantity_on_hand = ?, data_origin = 'operational'
         WHERE business_id = ? AND product_sku = ?`,
        [nextQuantity, normalizedBusinessId, productId],
      );

      if (quantityDeltaMilli !== 0n) {
        const newMovement = new InventoryMovement({
          businessId: normalizedBusinessId,
          productId,
          userId: change.userId,
          type: change.type,
          quantityDelta: scaledIntegerToNumber(quantityDeltaMilli, 3),
          unit: productUnit,
          note: change.note ?? null,
        });
        const [result] = await connection.execute(
          `INSERT INTO inventory_movements
             (business_id, product_sku, user_id, movement_type, quantity_delta, unit, note)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            newMovement.businessId,
            newMovement.productId,
            newMovement.userId,
            newMovement.type,
            scaledIntegerToDecimal(quantityDeltaMilli, 3),
            newMovement.unit,
            newMovement.note,
          ],
        );
        movement = new InventoryMovement({
          ...newMovement.toPublicObject(),
          id: result.insertId,
        });
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    return {
      inventory: await this.get(normalizedBusinessId, productId),
      movement,
    };
  }

  async getMovements(businessId, product, limit = 100) {
    const productId = productIdOf(product);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000) {
      throw new DomainError('El límite debe ser un entero entre 1 y 1000.', {
        code: 'INVALID_MOVEMENT_LIMIT',
      });
    }
    const [rows] = await this.#requirePool().execute(
      `SELECT m.id, m.business_id, m.product_sku, m.user_id, u.email AS user_email,
              m.movement_type, m.quantity_delta, m.unit, m.note, m.created_at
       FROM inventory_movements m
       LEFT JOIN users u ON u.id = m.user_id
       WHERE m.business_id = ? AND m.product_sku = ?
       ORDER BY m.created_at DESC, m.id DESC
       LIMIT ?`,
      [String(businessId), productId, limit],
    );
    return rows.map(toMovement);
  }
}

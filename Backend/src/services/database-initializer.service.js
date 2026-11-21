import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const schemaPath = fileURLToPath(new URL('../../database/schema.sql', import.meta.url));

export class DatabaseInitializer {
  constructor(pool) {
    this.pool = pool;
  }

  async initialize() {
    if (!this.pool) {
      throw new Error('No hay una conexión MySQL configurada en Backend/.env.');
    }

    await this.pool.query('SELECT 1');
    const schema = readFileSync(schemaPath, 'utf8')
      .replace(/^\s*--.*$/gm, '');
    const statements = schema.split(';').map(statement => statement.trim()).filter(Boolean);

    for (const statement of statements) {
      await this.pool.query(statement);
    }

    await this.#ensureInventoryOriginColumn();
  }

  async #ensureInventoryOriginColumn() {
    const [columns] = await this.pool.execute(
      `SELECT COLUMN_NAME
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'current_inventory'
         AND COLUMN_NAME = 'data_origin'`,
    );

    if (columns.length === 0) {
      await this.pool.query(
        `ALTER TABLE current_inventory
         ADD COLUMN data_origin ENUM('synthetic', 'operational')
         NOT NULL DEFAULT 'synthetic' AFTER quantity_on_hand`,
      );
    }
  }
}

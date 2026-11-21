import { createReadStream } from 'node:fs';
import path from 'node:path';
import { parseCsvObjectStream } from '../utils/csv-reader.js';

export class CsvImporterService {
  constructor({ highWaterMark = 64 * 1024, maxFieldCharacters = 1_000_000 } = {}) {
    this.highWaterMark = highWaterMark;
    this.maxFieldCharacters = maxFieldCharacters;
  }

  read(filePath, { requiredColumns = [], source = path.basename(filePath) } = {}) {
    const stream = createReadStream(filePath, { highWaterMark: this.highWaterMark });
    return parseCsvObjectStream(stream, {
      source,
      requiredColumns,
      maxFieldCharacters: this.maxFieldCharacters,
    });
  }

  async first(filePath, options = {}) {
    const rows = this.read(filePath, options);
    try {
      const firstRow = await rows.next();
      if (firstRow.done) throw new SyntaxError(`${options.source ?? path.basename(filePath)} no contiene registros.`);
      return firstRow.value;
    } finally {
      await rows.return();
    }
  }
}

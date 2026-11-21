import { StringDecoder } from 'node:string_decoder';

export function parseCsv(text) {
  if (typeof text !== 'string') throw new TypeError('CSV content must be a string');

  const source = text.replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  let quoteClosed = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];

    if (quoted) {
      if (character === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
          quoteClosed = true;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (quoteClosed && ![',', '\r', '\n', ' ', '\t'].includes(character)) {
      throw new SyntaxError(`Unexpected character after a closing quote at CSV offset ${index}`);
    }

    if (character === '"') {
      if (field.length > 0 || quoteClosed) {
        throw new SyntaxError(`Unexpected quote at CSV offset ${index}`);
      }
      quoted = true;
    } else if (character === ',') {
      row.push(field);
      field = '';
      quoteClosed = false;
    } else if (character === '\r' || character === '\n') {
      if (character === '\r' && source[index + 1] === '\n') index += 1;
      row.push(field);
      if (!(row.length === 1 && row[0] === '' && rows.length === 0)) rows.push(row);
      row = [];
      field = '';
      quoteClosed = false;
    } else if (!quoteClosed) {
      field += character;
    }
  }

  if (quoted) throw new SyntaxError('CSV contains an unterminated quoted field');
  if (row.length > 0 || field.length > 0 || quoteClosed) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

export function parseCsvObjects(text, { source = 'CSV' } = {}) {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];

  const headers = rows[0].map((header) => header.trim());
  if (headers.some((header) => !header)) {
    throw new SyntaxError(`${source} has an empty column name`);
  }
  if (new Set(headers).size !== headers.length) {
    throw new SyntaxError(`${source} has duplicate column names`);
  }

  return rows.slice(1).map((values, index) => {
    if (values.length !== headers.length) {
      throw new SyntaxError(
        `${source} row ${index + 2} has ${values.length} fields; expected ${headers.length}`,
      );
    }
    return Object.fromEntries(headers.map((header, column) => [header, values[column]]));
  });
}

async function* parseCsvRows(readable, { source, maxFieldCharacters }) {
  const decoder = new StringDecoder('utf8');
  let row = [];
  let field = '';
  let quoted = false;
  let quotePending = false;
  let quoteClosed = false;
  let skipLineFeed = false;
  let firstCharacter = true;
  let offset = 0;

  const consume = text => {
    const emitted = [];
    for (const character of text) {
      offset += 1;
      if (firstCharacter) {
        firstCharacter = false;
        if (character === '\uFEFF') continue;
      }

      if (quotePending) {
        quotePending = false;
        if (character === '"') {
          field += '"';
          continue;
        }
        quoted = false;
        quoteClosed = true;
      }

      if (quoted) {
        if (character === '"') quotePending = true;
        else field += character;
      } else if (skipLineFeed) {
        skipLineFeed = false;
        if (character === '\n') continue;
        consumeCharacter(character, emitted);
      } else {
        consumeCharacter(character, emitted);
      }

      if (field.length > maxFieldCharacters) {
        throw new SyntaxError(`${source} contiene un campo que supera el límite permitido.`);
      }
    }
    return emitted;
  };

  const consumeCharacter = (character, emitted) => {
    if (quoteClosed && [' ', '\t'].includes(character)) return;
    if (quoteClosed && ![',', '\r', '\n'].includes(character)) {
      throw new SyntaxError(`${source} contiene texto inesperado después de una comilla, cerca del carácter ${offset}.`);
    }

    if (character === '"') {
      if (field.length > 0 || quoteClosed) {
        throw new SyntaxError(`${source} contiene una comilla inesperada, cerca del carácter ${offset}.`);
      }
      quoted = true;
    } else if (character === ',') {
      row.push(field);
      field = '';
      quoteClosed = false;
    } else if (character === '\r' || character === '\n') {
      row.push(field);
      emitted.push(row);
      row = [];
      field = '';
      quoteClosed = false;
      if (character === '\r') skipLineFeed = true;
    } else {
      field += character;
      quoteClosed = false;
    }
  };

  for await (const chunk of readable) {
    const text = typeof chunk === 'string' ? chunk : decoder.write(chunk);
    yield* consume(text);
  }

  const finalText = decoder.end();
  if (finalText) yield* consume(finalText);
  if (quotePending) {
    quotePending = false;
    quoted = false;
    quoteClosed = true;
  }
  if (quoted) throw new SyntaxError(`${source} termina dentro de un campo entrecomillado.`);
  if (row.length > 0 || field.length > 0 || quoteClosed) {
    row.push(field);
    yield row;
  }
}

export async function* parseCsvObjectStream(readable, {
  source = 'CSV',
  requiredColumns = [],
  maxFieldCharacters = 1_000_000,
} = {}) {
  let headers;
  let rowNumber = 0;

  for await (const values of parseCsvRows(readable, { source, maxFieldCharacters })) {
    rowNumber += 1;
    if (!headers) {
      headers = values.map(header => header.trim());
      if (headers.some(header => !header)) {
        throw new SyntaxError(`${source} fila 1 contiene un nombre de columna vacío.`);
      }
      if (new Set(headers).size !== headers.length) {
        throw new SyntaxError(`${source} fila 1 contiene columnas repetidas.`);
      }
      const missingColumns = requiredColumns.filter(column => !headers.includes(column));
      if (missingColumns.length > 0) {
        throw new SyntaxError(`${source} fila 1 no contiene las columnas requeridas: ${missingColumns.join(', ')}.`);
      }
      continue;
    }

    if (values.length === 1 && values[0] === '') continue;
    if (values.length !== headers.length) {
      throw new SyntaxError(
        `${source} fila ${rowNumber} tiene ${values.length} campos; se esperaban ${headers.length}.`,
      );
    }
    yield {
      rowNumber,
      record: Object.fromEntries(headers.map((header, index) => [header, values[index]])),
    };
  }

  if (!headers) throw new SyntaxError(`${source} no contiene encabezados.`);
}

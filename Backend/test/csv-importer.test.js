import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { test } from 'node:test';
import { BusinessAssortmentImporterService } from '../src/services/business-assortment-importer.service.js';
import { ProductCatalogImporterService } from '../src/services/product-catalog-importer.service.js';
import { WeeklySalesImporterService } from '../src/services/weekly-sales-importer.service.js';
import { parseCsvObjectStream } from '../src/utils/csv-reader.js';

function streamChunks(text, chunkSize = 3) {
  const buffer = Buffer.from(text);
  const chunks = [];
  for (let offset = 0; offset < buffer.length; offset += chunkSize) {
    chunks.push(buffer.subarray(offset, offset + chunkSize));
  }
  return Readable.from(chunks);
}

test('el lector CSV procesa flujos grandes y comillas divididas entre bloques', async () => {
  async function* content() {
    yield Buffer.from('\uFEFFsku,nombre,unidad\r\n');
    for (let index = 0; index < 20_000; index += 1) {
      yield Buffer.from(`P${index},"Producto, número ${index}",pieza\r\n`);
    }
  }

  let rows = 0;
  let lastRow;
  for await (const row of parseCsvObjectStream(Readable.from(content()), {
    source: 'productos.csv',
    requiredColumns: ['sku', 'nombre', 'unidad'],
  })) {
    rows += 1;
    lastRow = row;
  }

  assert.equal(rows, 20_000);
  assert.equal(lastRow.rowNumber, 20_001);
  assert.equal(lastRow.record.nombre, 'Producto, número 19999');

  const quoted = [];
  for await (const row of parseCsvObjectStream(streamChunks(
    '\uFEFFsku,nota,unidad\r\nA1,"Incluye ""doble comilla""\ny otra línea",kg\r\n',
  ), { source: 'movimientos.csv', requiredColumns: ['sku', 'nota', 'unidad'] })) {
    quoted.push(row);
  }
  assert.equal(quoted[0].record.nota, 'Incluye "doble comilla"\ny otra línea');
});

test('el lector CSV informa encabezados repetidos y filas con columnas faltantes', async () => {
  await assert.rejects(async () => {
    for await (const _row of parseCsvObjectStream(streamChunks('sku,sku\nA1,A2\n'), { source: 'duplicado.csv' })) {
      // La iteración debe rechazar el encabezado antes de producir filas.
    }
  }, /columnas repetidas/);

  await assert.rejects(async () => {
    for await (const _row of parseCsvObjectStream(streamChunks('sku,nombre\nA1\n'), { source: 'incompleto.csv' })) {
      // La iteración debe rechazar el registro que no coincide con el encabezado.
    }
  }, /fila 2 tiene 1 campos; se esperaban 2/);
});

test('el importador rechaza SKUs duplicados y asociaciones de surtido inválidas', async () => {
  let statements = 0;
  const executor = { execute: async () => { statements += 1; } };
  const catalogText = [
    'producto_id,producto,marca,categoria,unidad',
    'PS001,Manzana roja,Granel,Frutas,kg',
    'PS001,Manzana roja,Granel,Frutas,kg',
  ].join('\n');
  const catalogImporter = new ProductCatalogImporterService({
    csvImporter: { read: (_file, options) => parseCsvObjectStream(streamChunks(catalogText), options) },
  });
  await assert.rejects(catalogImporter.import(executor, 'catalogo.csv'), /SKU PS001 está repetido/);

  const assortmentText = [
    'negocio_id,producto_id',
    '201,PS001',
    '201,PS001',
  ].join('\n');
  const assortmentImporter = new BusinessAssortmentImporterService({
    csvImporter: { read: (_file, options) => parseCsvObjectStream(streamChunks(assortmentText), options) },
  });
  await assert.rejects(assortmentImporter.import(executor, 'surtido.csv', {
    businesses: new Map([['201', { id: '201', name: 'Negocio demo' }]]),
    products: new Map([['PS001', { sku: 'PS001' }]]),
  }), /relación 201\/PS001 está repetida/);

  await assert.rejects(assortmentImporter.import(executor, 'surtido.csv', {
    businesses: new Map([['201', { id: '201', name: 'Negocio demo' }]]),
    products: new Map(),
  }), /SKU PS001 no existe en el catálogo global/);
  assert.equal(statements, 0);
});

test('el importador de ventas rechaza valores inválidos y filas de la matriz', async () => {
  const headers = [
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
  const row = {
    registro_id: 'demo-201-ps001-1',
    negocio_id: '201',
    negocio: 'Negocio demo',
    es_referencia_matriz: '0',
    semana_numero: '1',
    fecha_inicio: '2026-02-02',
    fecha_fin: '2026-02-08',
    producto_id: 'PS001',
    producto: 'Manzana roja',
    marca: 'Granel',
    categoria: 'Frutas',
    unidad: 'kg',
    precio_lista_mxn: '10',
    descuento_pct: '0',
    precio_unitario_mxn: '10',
    unidades_vendidas: 'no es número',
    ingresos_mxn: '20',
    costo_unitario_mxn: '5',
    utilidad_bruta_mxn: '10',
    inventario_inicial: '4',
    reabastecimiento_unidades: '1',
    merma_unidades: '0',
    inventario_final: '3',
    ventas_semana_anterior: '',
    es_buen_fin: '0',
    es_black_friday: '0',
    es_cyber_monday: '0',
    es_navidad: '0',
    es_regreso_clases: '0',
    es_dia_madres: '0',
    es_promocion: '0',
  };
  let csvText = `${headers.join(',')}\n${headers.map(column => row[column]).join(',')}\n`;
  const csvImporter = {
    read: (_filePath, options) => parseCsvObjectStream(streamChunks(csvText), options),
  };
  const executor = { query: async () => {}, execute: async () => {} };
  const importer = new WeeklySalesImporterService({ csvImporter, storeFiles: ['tienda.csv'] });
  const context = {
    businesses: new Map([['201', { id: '201', name: 'Negocio demo' }]]),
    products: new Map([['PS001', {
      sku: 'PS001', name: 'Manzana roja', brand: 'Granel', category: 'Frutas', unit: 'kg',
    }]]),
    assortment: new Set(['201\u001fPS001']),
  };

  await assert.rejects(importer.import(executor, context), /tienda.csv fila 2: unidades_vendidas no contiene un valor válido/);

  const serializeRow = () => `${headers.join(',')}\n${headers.map(column => row[column]).join(',')}\n`;
  row.unidades_vendidas = '0.0005';
  csvText = serializeRow();
  await assert.rejects(importer.import(executor, context), /unidades_vendidas admite como máximo 3 decimales/);

  row.unidades_vendidas = '2';
  row.precio_lista_mxn = '10.001';
  csvText = serializeRow();
  await assert.rejects(importer.import(executor, context), /precio_lista_mxn admite como máximo 2 decimales/);

  row.precio_lista_mxn = '10';
  row.semana_numero = '65536';
  csvText = serializeRow();
  await assert.rejects(importer.import(executor, context), /semana_numero no contiene un valor válido/);

  row.semana_numero = '1';
  csvText = serializeRow();
  const collisionExecutor = {
    query: async () => {},
    execute: async sql => sql.includes('JOIN weekly_sales')
      ? [[{ source_record_id: row.registro_id, source_line: 2 }]]
      : [{}],
  };
  await assert.rejects(
    importer.import(collisionExecutor, context),
    /fila 2 usa el registro_id demo-201-ps001-1, que ya pertenece a otra venta/,
  );

  row.es_referencia_matriz = '1';
  row.negocio_id = '900';
  row.negocio = 'Matriz de referencia';
  csvText = serializeRow();
  await assert.rejects(importer.import(executor, context), /matriz o un negocio no autorizado/);
});

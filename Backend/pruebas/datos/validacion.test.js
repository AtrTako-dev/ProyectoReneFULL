const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { leerArchivosDemo } = require('../../src/datos/archivos');
const { aCentavos, desdeCentavos } = require('../../src/datos/dinero');
const {
  validarMetadataDemo,
  validarVentaImportada,
  validarVentaBd,
  validarRangoConsulta,
} = require('../../src/datos/validacion');

const HOY = '2026-11-12';

function metadataDemo(extra = {}) {
  return {
    conjunto: 'sucursal_demo_01',
    perfil_demanda: 'balanceado',
    datos_simulados: true,
    moneda: 'MXN',
    periodo_inicio: '2026-01-01',
    periodo_fin: '2026-06-30',
    cantidad_registros: 1,
    ...extra,
  };
}

function ventaDemo(extra = {}) {
  return {
    id_venta: 'D01-066',
    fecha: '2026-01-01',
    producto_id: 'B003',
    producto: 'Jugo de naranja 1 L',
    categoria: 'Bebidas',
    precio_unitario_mxn: 31,
    cantidad: 4,
    total_mxn: 124,
    ...extra,
  };
}

test('conserva identificadores de texto y calcula importes en centavos', () => {
  const resultado = validarVentaImportada(ventaDemo(), {
    archivo: 'demo.json',
    indice: 1,
    metadata: metadataDemo(),
    hoy: HOY,
  });
  assert.deepEqual(resultado.problemas, []);
  assert.equal(resultado.datos.idOrigen, 'D01-066');
  assert.equal(resultado.datos.productoId, 'B003');
  assert.equal(resultado.datos.precioCentavos, 3100);
  assert.equal(resultado.datos.totalCentavos, 12400);
  assert.equal(aCentavos('17.50'), 1750);
  assert.equal(desdeCentavos(1750), '17.50');
});

test('rechaza identificadores numéricos en lugar de códigos de texto', () => {
  const resultado = validarVentaImportada(ventaDemo({ producto_id: 3, id_venta: 1 }), {
    archivo: 'demo.json',
    indice: 1,
    metadata: metadataDemo(),
    hoy: HOY,
  });
  const campos = resultado.problemas.map((problema) => problema.campo);
  assert.ok(campos.includes('producto_id'));
  assert.ok(campos.includes('id_venta'));
});

test('rechaza totales incongruentes, fechas futuras y precios con más de dos decimales', () => {
  const total = validarVentaImportada(ventaDemo({ total_mxn: 120 }), {
    archivo: 'demo.json',
    indice: 1,
    metadata: metadataDemo(),
    hoy: HOY,
  });
  assert.ok(total.problemas.some((problema) => problema.campo === 'total_mxn'));

  const futuro = validarVentaImportada(ventaDemo({ fecha: '2026-12-01' }), {
    archivo: 'demo.json',
    indice: 1,
    metadata: metadataDemo(),
    hoy: HOY,
  });
  assert.ok(futuro.problemas.some((problema) => problema.campo === 'fecha'));

  const precision = validarVentaImportada(ventaDemo({ precio_unitario_mxn: 1.234 }), {
    archivo: 'demo.json',
    indice: 1,
    metadata: metadataDemo(),
    hoy: HOY,
  });
  assert.ok(precision.problemas.some((problema) => problema.campo === 'precio_unitario_mxn'));
});

test('valida metadatos y exige que los datos sean simulados', () => {
  assert.deepEqual(
    validarMetadataDemo(metadataDemo(), { archivo: 'demo.json', cantidadFilas: 1 }),
    []
  );
  const problemas = validarMetadataDemo(
    metadataDemo({ datos_simulados: false, cantidad_registros: 2 }),
    { archivo: 'demo.json', cantidadFilas: 1 }
  );
  assert.ok(problemas.some((problema) => problema.campo === 'datos_simulados'));
  assert.ok(problemas.some((problema) => problema.campo === 'cantidad_registros'));
});

test('valida ventas leídas de MySQL contra el catálogo y los importes', () => {
  const catalogo = new Map([
    ['B003', { producto: 'Jugo de naranja 1 L', categoria: 'Bebidas' }],
  ]);
  const fila = {
    id_venta: 1,
    usuario_id: 2,
    fecha: '2026-01-01',
    producto_id: 'B003',
    producto: 'Jugo de naranja 1 L',
    categoria: 'Bebidas',
    precio_unitario_mxn: '31.00',
    cantidad: 4,
    total_mxn: '124.00',
  };
  assert.deepEqual(validarVentaBd(fila, catalogo), { valida: true, problemas: [] });

  const alterada = validarVentaBd({ ...fila, producto: 'Otro producto' }, catalogo);
  assert.equal(alterada.valida, false);
  assert.ok(alterada.problemas.includes('producto'));

  const totalMal = validarVentaBd({ ...fila, total_mxn: '120.00' }, catalogo);
  assert.equal(totalMal.valida, false);
  assert.ok(totalMal.problemas.includes('total_mxn'));
});

test('limita los rangos de consulta a 730 días', () => {
  assert.equal(validarRangoConsulta({ desde: '2026-01-01', hasta: '2027-12-31' }).valida, true);
  const fuera = validarRangoConsulta({ desde: '2026-01-01', hasta: '2028-01-02' });
  assert.equal(fuera.valida, false);
  assert.ok(fuera.problemas.some((problema) => problema.campo === 'rango'));
});

test('lee los cinco JSON, 100 ventas por archivo y 41 productos sin perder IDs', () => {
  const { archivos, catalogo } = leerArchivosDemo({
    directorio: path.join(__dirname, '..', '..', 'data', 'demo'),
    hoy: HOY,
  });
  assert.equal(archivos.length, 5);
  assert.equal(archivos.reduce((suma, archivo) => suma + archivo.ventas.length, 0), 500);
  assert.ok(archivos.every((archivo) => archivo.ventas.length === 100));
  assert.equal(catalogo.size, 41);
  const ids = archivos.flatMap((archivo) => archivo.ventas.map((venta) => venta.idOrigen));
  assert.equal(new Set(ids).size, 500);
  assert.ok(ids.includes('D01-066'));
  assert.deepEqual(
    [...catalogo.keys()].filter((id) => !/^[A-Z]{1,3}[0-9]{3}$/.test(id)),
    []
  );
});

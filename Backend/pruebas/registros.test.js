const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validarRegistroVenta, filtrarVentasValidas } = require('../src/servicios/registros');

const PROPIETARIO_ID = '11111111-1111-4111-8111-111111111111';

function filaValida(extra = {}) {
  return {
    id: 1,
    propietario_id: PROPIETARIO_ID,
    fecha: '2026-01-15',
    producto_id: 'B003',
    producto: 'Jugo de naranja 1 L',
    categoria: 'Bebidas',
    precio_unitario_mxn: 31,
    cantidad: 4,
    total_mxn: 124,
    importacion_id: 2,
    id_origen: 'D01-066',
    clave_idempotencia: null,
    ...extra,
  };
}

test('una fila correcta es válida', () => {
  assert.deepEqual(validarRegistroVenta(filaValida()), { valida: true, problemas: [] });
});

test('una venta propia sin importación es válida', () => {
  const fila = filaValida({ importacion_id: null, id_origen: null });
  assert.deepEqual(validarRegistroVenta(fila), { valida: true, problemas: [] });
});

test('detecta cantidades, precios y totales inválidos', () => {
  assert.ok(validarRegistroVenta(filaValida({ cantidad: 0 })).problemas.includes('cantidad'));
  assert.ok(
    validarRegistroVenta(filaValida({ precio_unitario_mxn: -1 })).problemas.includes(
      'precio_unitario_mxn'
    )
  );
  assert.ok(validarRegistroVenta(filaValida({ total_mxn: 20 })).problemas.includes('total_mxn'));
});

test('detecta fechas, UUID y textos inválidos', () => {
  assert.ok(validarRegistroVenta(filaValida({ fecha: '2026-02-30' })).problemas.includes('fecha'));
  assert.ok(
    validarRegistroVenta(filaValida({ propietario_id: 'no-uuid' })).problemas.includes(
      'propietario_id'
    )
  );
  assert.ok(validarRegistroVenta(filaValida({ producto: '  ' })).problemas.includes('producto'));
  assert.ok(validarRegistroVenta(filaValida({ categoria: '' })).problemas.includes('categoria'));
  assert.ok(
    validarRegistroVenta(filaValida({ producto_id: 'ZZ' })).problemas.includes('producto_id')
  );
});

test('una importación exige id_origen y viceversa', () => {
  const sinOrigen = validarRegistroVenta(filaValida({ id_origen: null }));
  assert.ok(sinOrigen.problemas.includes('importacion_id'));
  assert.ok(sinOrigen.problemas.includes('id_origen'));

  const sinImportacion = validarRegistroVenta(filaValida({ importacion_id: null }));
  assert.ok(sinImportacion.problemas.includes('importacion_id'));
  assert.ok(sinImportacion.problemas.includes('id_origen'));
});

test('detecta clave de idempotencia con formato inválido', () => {
  const resultado = validarRegistroVenta(filaValida({ clave_idempotencia: 'abc' }));
  assert.ok(resultado.problemas.includes('clave_idempotencia'));
});

test('separa filas válidas de inválidas', () => {
  const resultado = filtrarVentasValidas([
    filaValida({ id: 1 }),
    filaValida({ id: 2, cantidad: 0 }),
    filaValida({ id: 3, total_mxn: 999 }),
  ]);

  assert.equal(resultado.validas.length, 1);
  assert.equal(resultado.invalidas.length, 2);
  assert.equal(resultado.validas[0].id, 1);
});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validarRegistroVenta, filtrarVentasValidas } = require('../src/servicios/registros');

function filaValida(extra = {}) {
  return {
    id_venta: 1,
    usuario_id: 4,
    fecha: '2026-01-15',
    producto_id: 3,
    producto: 'Producto demo',
    categoria: 'electronics',
    precio_unitario_mxn: 10.5,
    cantidad: 2,
    total_mxn: 21,
    ...extra,
  };
}

test('una fila correcta es válida', () => {
  assert.deepEqual(validarRegistroVenta(filaValida()), { valida: true, problemas: [] });
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

test('detecta fechas y textos inválidos', () => {
  assert.ok(validarRegistroVenta(filaValida({ fecha: '2026-02-30' })).problemas.includes('fecha'));
  assert.ok(validarRegistroVenta(filaValida({ producto: '  ' })).problemas.includes('producto'));
  assert.ok(validarRegistroVenta(filaValida({ categoria: '' })).problemas.includes('categoria'));
  assert.ok(validarRegistroVenta(filaValida({ producto_id: 0 })).problemas.includes('producto_id'));
});

test('separa filas válidas de inválidas', () => {
  const resultado = filtrarVentasValidas([
    filaValida({ id_venta: 1 }),
    filaValida({ id_venta: 2, cantidad: 0 }),
    filaValida({ id_venta: 3, total_mxn: 999 }),
  ]);

  assert.equal(resultado.validas.length, 1);
  assert.equal(resultado.invalidas.length, 2);
  assert.equal(resultado.validas[0].id_venta, 1);
});

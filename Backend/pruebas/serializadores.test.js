const { test } = require('node:test');
const assert = require('node:assert/strict');
const { usuarioPublico, ventaPublica } = require('../src/servicios/serializadores');

test('el usuario público nunca incluye el hash de contraseña', () => {
  const publico = usuarioPublico({
    id: 5,
    nombre: 'Mia',
    email: 'mia@ejemplo.com',
    rol: 'cliente',
    password_hash: '$argon2id$secreto',
    creado_en: '2026-01-01',
  });

  assert.deepEqual(publico, {
    id: 5,
    nombre: 'Mia',
    email: 'mia@ejemplo.com',
    rol: 'cliente',
  });
  assert.equal(JSON.stringify(publico).includes('argon2'), false);
});

test('la venta pública devuelve números y campos esperados', () => {
  const venta = ventaPublica({
    id_venta: '8',
    usuario_id: '5',
    fecha: '2026-01-15',
    producto_id: '3',
    producto: 'Producto demo',
    categoria: 'electronics',
    precio_unitario_mxn: '10.50',
    cantidad: '2',
    total_mxn: '21.00',
  });

  assert.deepEqual(venta, {
    id_venta: 8,
    usuario_id: 5,
    fecha: '2026-01-15',
    producto_id: 3,
    producto: 'Producto demo',
    categoria: 'electronics',
    precio_unitario_mxn: 10.5,
    cantidad: 2,
    total_mxn: 21,
  });
});

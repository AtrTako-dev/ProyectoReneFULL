const { test } = require('node:test');
const assert = require('node:assert/strict');
const { usuarioPublico, ventaPublica } = require('../src/servicios/serializadores');

const PROPIETARIO_ID = '11111111-1111-4111-8111-111111111111';

test('el usuario público usa correo y activo, y nunca incluye el hash', () => {
  const publico = usuarioPublico({
    id: PROPIETARIO_ID,
    nombre: 'Mia',
    correo: 'mia@ejemplo.com',
    rol: 'cliente',
    activo: 1,
    password_hash: '$argon2id$secreto',
    creado_en: '2026-01-01',
  });

  assert.deepEqual(publico, {
    id: PROPIETARIO_ID,
    nombre: 'Mia',
    correo: 'mia@ejemplo.com',
    rol: 'cliente',
    activo: true,
  });
  assert.equal(JSON.stringify(publico).includes('argon2'), false);
});

test('la venta pública conserva ids de catálogo como texto y normaliza números', () => {
  const venta = ventaPublica({
    id: '8',
    propietario_id: PROPIETARIO_ID,
    fecha: '2026-01-15',
    producto_id: 'B003',
    producto: 'Jugo de naranja 1 L',
    categoria: 'Bebidas',
    precio_unitario_mxn: '31.00',
    cantidad: '4',
    total_mxn: '124.00',
    importacion_id: '4',
    id_origen: 'D01-066',
    es_demostracion: 1,
  });

  assert.deepEqual(venta, {
    id: 8,
    propietario_id: PROPIETARIO_ID,
    fecha: '2026-01-15',
    producto_id: 'B003',
    producto: 'Jugo de naranja 1 L',
    categoria: 'Bebidas',
    precio_unitario_mxn: 31,
    cantidad: 4,
    total_mxn: 124,
    importacion_id: 4,
    id_origen: 'D01-066',
    es_demostracion: true,
  });
});

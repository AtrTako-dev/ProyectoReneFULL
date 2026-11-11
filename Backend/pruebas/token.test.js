process.env.JWT_SECRETO = 'secreto-de-pruebas-para-tokens-1234567890';
process.env.JWT_HORAS = '2';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { firmarToken, verificarToken } = require('../src/servicios/token');

test('firma un token con la identidad del usuario', () => {
  const token = firmarToken(12);
  const contenido = verificarToken(token);

  assert.equal(contenido.sub, '12');
  assert.ok(contenido.exp > contenido.iat);
});

test('rechaza un token alterado', () => {
  const token = firmarToken(1);
  assert.throws(() => verificarToken(`${token}x`));
});

test('rechaza un token firmado con otro secreto', () => {
  const token = jwt.sign({ sub: '1' }, 'otro-secreto');
  assert.throws(() => verificarToken(token));
});

test('rechaza un token expirado', () => {
  const token = jwt.sign({ sub: '1' }, process.env.JWT_SECRETO, { expiresIn: '-1s' });
  assert.throws(() => verificarToken(token));
});

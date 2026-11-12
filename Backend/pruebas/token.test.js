process.env.JWT_SECRETO = 'secreto-de-pruebas-para-tokens-1234567890';
process.env.JWT_HORAS = '2';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { firmarToken, verificarToken } = require('../src/servicios/token');

const USUARIO_ID = '11111111-1111-4111-8111-111111111111';

test('firma un token con el UUID del usuario como sub', () => {
  const token = firmarToken(USUARIO_ID);
  const contenido = verificarToken(token);

  assert.equal(contenido.sub, USUARIO_ID);
  assert.ok(contenido.exp > contenido.iat);
  assert.equal(contenido.rol, undefined);
});

test('rechaza un token alterado', () => {
  const token = firmarToken(USUARIO_ID);
  assert.throws(() => verificarToken(`${token}x`));
});

test('rechaza un token firmado con otro secreto', () => {
  const token = jwt.sign({ sub: USUARIO_ID }, 'otro-secreto');
  assert.throws(() => verificarToken(token));
});

test('rechaza un token expirado', () => {
  const token = jwt.sign({ sub: USUARIO_ID }, process.env.JWT_SECRETO, { expiresIn: '-1s' });
  assert.throws(() => verificarToken(token));
});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { hashear, verificar } = require('../src/servicios/password');

test('genera un hash Argon2id', async () => {
  const hash = await hashear('secreto123');
  assert.match(hash, /^\$argon2id\$/);
  assert.equal(hash.includes('secreto123'), false);
});

test('verifica la contraseña correcta y rechaza la incorrecta', async () => {
  const hash = await hashear('secreto123');

  assert.equal(await verificar(hash, 'secreto123'), true);
  assert.equal(await verificar(hash, 'secreto124'), false);
});

test('usa una sal distinta para la misma contraseña', async () => {
  const primero = await hashear('secreto123');
  const segundo = await hashear('secreto123');

  assert.notEqual(primero, segundo);
});

test('un hash inválido no autentica', async () => {
  assert.equal(await verificar('no-es-un-hash', 'secreto123'), false);
});

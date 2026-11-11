process.env.NODE_ENV = 'test';
process.env.JWT_SECRETO = 'secreto-de-pruebas-para-tokens-1234567890';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');

let servidor;
let base;

before(async () => {
  servidor = app.listen(0);
  await new Promise((resolve) => servidor.once('listening', resolve));
  base = `http://127.0.0.1:${servidor.address().port}`;
});

after(() => new Promise((resolve) => servidor.close(resolve)));

async function pedir(ruta, opciones = {}) {
  const respuesta = await fetch(`${base}${ruta}`, opciones);
  const cuerpo = await respuesta.json();
  return { estado: respuesta.status, cuerpo };
}

test('la ruta de salud responde', async () => {
  const { estado, cuerpo } = await pedir('/api/salud');
  assert.equal(estado, 200);
  assert.deepEqual(cuerpo, { estado: 'ok' });
});

test('una ruta inexistente responde 404 controlado', async () => {
  const { estado, cuerpo } = await pedir('/api/no-existe');
  assert.equal(estado, 404);
  assert.equal(cuerpo.error.codigo, 'NO_ENCONTRADO');
});

test('las rutas de cliente exigen sesión', async () => {
  const { estado, cuerpo } = await pedir('/api/ventas/mias');
  assert.equal(estado, 401);
  assert.equal(cuerpo.error.codigo, 'NO_AUTENTICADO');
});

test('las rutas administrativas exigen sesión', async () => {
  const { estado, cuerpo } = await pedir('/api/admin/usuarios');
  assert.equal(estado, 401);
  assert.equal(cuerpo.error.codigo, 'NO_AUTENTICADO');
});

test('un token inválido responde 401', async () => {
  const { estado, cuerpo } = await pedir('/api/admin/usuarios', {
    headers: { authorization: 'Bearer token-invalido' },
  });
  assert.equal(estado, 401);
  assert.equal(cuerpo.error.codigo, 'NO_AUTENTICADO');
});

test('GET /api/auth/me sin sesión responde 401', async () => {
  const { estado, cuerpo } = await pedir('/api/auth/me');
  assert.equal(estado, 401);
  assert.equal(cuerpo.error.codigo, 'NO_AUTENTICADO');
});

test('un cuerpo con JSON malformado responde 400', async () => {
  const { estado, cuerpo } = await pedir('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{"email":',
  });
  assert.equal(estado, 400);
  assert.equal(cuerpo.error.codigo, 'JSON_INVALIDO');
});

test('el registro rechaza la asignación de rol', async () => {
  const { estado, cuerpo } = await pedir('/api/auth/registro', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      nombre: 'Mia',
      email: 'mia@ejemplo.com',
      password: 'secreto123',
      rol: 'administrador',
    }),
  });

  assert.equal(estado, 422);
  assert.equal(cuerpo.error.codigo, 'VALIDACION_DATOS');
  assert.ok(cuerpo.error.campos.rol);
});

test('el registro valida los campos antes de tocar la base de datos', async () => {
  const { estado, cuerpo } = await pedir('/api/auth/registro', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ nombre: '', email: 'sin-arroba', password: 'corta' }),
  });

  assert.equal(estado, 422);
  assert.ok(cuerpo.error.campos.nombre);
  assert.ok(cuerpo.error.campos.email);
  assert.ok(cuerpo.error.campos.password);
});

test('el login valida el cuerpo antes de consultar la base de datos', async () => {
  const { estado, cuerpo } = await pedir('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'sin-arroba', password: '' }),
  });

  assert.equal(estado, 422);
  assert.ok(cuerpo.error.campos.email);
  assert.ok(cuerpo.error.campos.password);
});

process.env.JWT_SECRETO = 'secreto-de-pruebas-para-tokens-1234567890';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  crearRequiereAutenticacion,
  crearRequiereRol,
} = require('../src/middleware/auth');

function ejecutarMiddleware(middleware, req) {
  return new Promise((resolve) => {
    middleware(req, {}, (error) => resolve(error));
  });
}

test('sin encabezado de autorización responde 401', async () => {
  const middleware = crearRequiereAutenticacion();
  const error = await ejecutarMiddleware(middleware, { headers: {} });

  assert.equal(error.estado, 401);
  assert.equal(error.codigo, 'NO_AUTENTICADO');
});

test('un esquema que no es Bearer responde 401', async () => {
  const middleware = crearRequiereAutenticacion();
  const error = await ejecutarMiddleware(middleware, {
    headers: { authorization: 'Basic abc' },
  });

  assert.equal(error.estado, 401);
});

test('un token inválido responde 401', async () => {
  const middleware = crearRequiereAutenticacion();
  const error = await ejecutarMiddleware(middleware, {
    headers: { authorization: 'Bearer token-invalido' },
  });

  assert.equal(error.estado, 401);
});

test('un token válido deja la identidad en la solicitud', async () => {
  const middleware = crearRequiereAutenticacion({ verificar: () => ({ sub: '7' }) });
  const req = { headers: { authorization: 'Bearer cualquiera' } };

  const error = await ejecutarMiddleware(middleware, req);

  assert.equal(error, undefined);
  assert.equal(req.usuarioId, 7);
});

test('un cliente no puede acceder a una ruta administrativa', async () => {
  const middleware = crearRequiereRol(['administrador'], {
    buscarUsuario: async () => ({ id: 7, rol: 'cliente' }),
  });
  const req = { headers: {}, usuarioId: 7 };

  const error = await ejecutarMiddleware(middleware, req);

  assert.equal(error.estado, 403);
  assert.equal(error.codigo, 'NO_AUTORIZADO');
});

test('un administrador vigente sí accede', async () => {
  const middleware = crearRequiereRol(['administrador'], {
    buscarUsuario: async () => ({ id: 7, rol: 'administrador' }),
  });
  const req = { headers: {}, usuarioId: 7 };

  const error = await ejecutarMiddleware(middleware, req);

  assert.equal(error, undefined);
  assert.equal(req.usuario.rol, 'administrador');
});

test('una sesión de un usuario inexistente responde 401', async () => {
  const middleware = crearRequiereRol(['administrador'], {
    buscarUsuario: async () => null,
  });
  const req = { headers: {}, usuarioId: 99 };

  const error = await ejecutarMiddleware(middleware, req);

  assert.equal(error.estado, 401);
});

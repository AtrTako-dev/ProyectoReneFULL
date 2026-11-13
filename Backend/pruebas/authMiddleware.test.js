process.env.JWT_SECRETO = 'secreto-de-pruebas-para-tokens-1234567890';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  crearRequiereAutenticacion,
  crearRequiereRol,
  crearCargarUsuarioActual,
} = require('../src/middleware/auth');

const USUARIO_ID = '11111111-1111-4111-8111-111111111111';

function ejecutarMiddleware(middleware, req) {
  return new Promise((resolve) => {
    middleware(req, {}, (error) => resolve(error));
  });
}

function usuario(extra = {}) {
  return {
    id: USUARIO_ID,
    nombre: 'Mia',
    correo: 'mia@ejemplo.com',
    rol: 'cliente',
    activo: 1,
    ...extra,
  };
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

test('un token válido deja el UUID de identidad en la solicitud', async () => {
  const middleware = crearRequiereAutenticacion({ verificar: () => ({ sub: USUARIO_ID }) });
  const req = { headers: { authorization: 'Bearer cualquiera' } };

  const error = await ejecutarMiddleware(middleware, req);

  assert.equal(error, undefined);
  assert.equal(req.usuarioId, USUARIO_ID);
});

test('un token con sub que no es UUID responde 401', async () => {
  const middleware = crearRequiereAutenticacion({ verificar: () => ({ sub: '7' }) });
  const error = await ejecutarMiddleware(middleware, {
    headers: { authorization: 'Bearer cualquiera' },
  });

  assert.equal(error.estado, 401);
});

test('cargarUsuarioActual consulta la base y deja el usuario vigente', async () => {
  const middleware = crearCargarUsuarioActual({ buscarUsuario: async () => usuario() });
  const req = { usuarioId: USUARIO_ID };

  const error = await ejecutarMiddleware(middleware, req);

  assert.equal(error, undefined);
  assert.equal(req.usuario.rol, 'cliente');
});

test('una cuenta inactiva equivale a no tener sesión', async () => {
  const middleware = crearCargarUsuarioActual({
    buscarUsuario: async () => usuario({ activo: 0 }),
  });
  const error = await ejecutarMiddleware(middleware, { usuarioId: USUARIO_ID });

  assert.equal(error.estado, 401);
  assert.equal(error.codigo, 'NO_AUTENTICADO');
});

test('una cuenta eliminada equivale a no tener sesión', async () => {
  const middleware = crearCargarUsuarioActual({ buscarUsuario: async () => null });
  const error = await ejecutarMiddleware(middleware, { usuarioId: USUARIO_ID });

  assert.equal(error.estado, 401);
});

test('un cliente no puede acceder a una ruta administrativa', async () => {
  const middleware = crearRequiereRol(['administrador'], {
    buscarUsuario: async () => usuario({ rol: 'cliente' }),
  });
  const req = { headers: {}, usuarioId: USUARIO_ID };

  const error = await ejecutarMiddleware(middleware, req);

  assert.equal(error.estado, 403);
  assert.equal(error.codigo, 'NO_AUTORIZADO');
});

test('un administrador vigente sí accede', async () => {
  const middleware = crearRequiereRol(['administrador'], {
    buscarUsuario: async () => usuario({ rol: 'administrador' }),
  });
  const req = { headers: {}, usuarioId: USUARIO_ID };

  const error = await ejecutarMiddleware(middleware, req);

  assert.equal(error, undefined);
  assert.equal(req.usuario.rol, 'administrador');
});

test('una sesión de un usuario inexistente responde 401', async () => {
  const middleware = crearRequiereRol(['administrador'], {
    buscarUsuario: async () => null,
  });
  const req = { headers: {}, usuarioId: '99999999-9999-4999-8999-999999999999' };

  const error = await ejecutarMiddleware(middleware, req);

  assert.equal(error.estado, 401);
});

process.env.NODE_ENV = 'test';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { responderError, errores, ErrorApi } = require('../src/middleware/errores');

function respuestaFalsa() {
  return {
    codigo: null,
    cuerpo: null,
    status(codigo) {
      this.codigo = codigo;
      return this;
    },
    json(cuerpo) {
      this.cuerpo = cuerpo;
      return this;
    },
  };
}

test('error de validación responde 422 con detalle por campo', () => {
  const res = respuestaFalsa();
  responderError(res, errores.validacion({ email: 'El correo no tiene un formato válido' }));

  assert.equal(res.codigo, 422);
  assert.equal(res.cuerpo.error.codigo, 'VALIDACION_DATOS');
  assert.deepEqual(res.cuerpo.error.campos, {
    email: 'El correo no tiene un formato válido',
  });
});

test('error interno responde 500 sin filtrar detalles ni trazas', () => {
  const res = respuestaFalsa();
  responderError(
    res,
    new Error('ECONNREFUSED 127.0.0.1 usuario=root password=secreto-interno')
  );

  assert.equal(res.codigo, 500);
  assert.equal(res.cuerpo.error.codigo, 'ERROR_INTERNO');
  assert.equal(res.cuerpo.error.mensaje, 'Ocurrió un error interno. Intenta más tarde.');
  assert.equal(JSON.stringify(res.cuerpo).includes('secreto-interno'), false);
});

test('JSON malformado responde 400', () => {
  const res = respuestaFalsa();
  responderError(res, { type: 'entity.parse.failed' });

  assert.equal(res.codigo, 400);
  assert.equal(res.cuerpo.error.codigo, 'JSON_INVALIDO');
});

test('401 y 403 se distinguen', () => {
  const sinSesion = respuestaFalsa();
  responderError(sinSesion, errores.noAutenticado());
  assert.equal(sinSesion.codigo, 401);
  assert.equal(sinSesion.cuerpo.error.codigo, 'NO_AUTENTICADO');

  const sinPermiso = respuestaFalsa();
  responderError(sinPermiso, errores.noAutorizado());
  assert.equal(sinPermiso.codigo, 403);
  assert.equal(sinPermiso.cuerpo.error.codigo, 'NO_AUTORIZADO');
});

test('una restricción CHECK de MySQL se traduce a 422 sin exponer detalles', () => {
  const res = respuestaFalsa();
  responderError(res, {
    code: 'ER_CHECK_CONSTRAINT_VIOLATED',
    sqlMessage: "Check constraint 'ck_ventas_cantidad' is violated.",
  });

  assert.equal(res.codigo, 422);
  assert.equal(res.cuerpo.error.codigo, 'VALIDACION_DATOS');
  assert.equal(JSON.stringify(res.cuerpo).includes('ck_ventas_cantidad'), false);
});

test('ErrorApi conserva el mensaje específico y los campos opcionales', () => {
  const error = new ErrorApi(409, 'CONFLICTO', 'El correo ya está registrado.');
  const res = respuestaFalsa();
  responderError(res, error);

  assert.equal(res.codigo, 409);
  assert.equal(res.cuerpo.error.mensaje, 'El correo ya está registrado.');
  assert.equal(res.cuerpo.error.campos, undefined);
});

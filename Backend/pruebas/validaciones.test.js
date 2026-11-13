const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validarRegistro, validarLogin } = require('../src/validaciones/auth');
const {
  validarCreacionVenta,
  validarTotalDeclarado,
  validarRangoFechas,
  validarPaginacion,
} = require('../src/validaciones/ventas');
const {
  validarCambioRol,
  validarAgrupacion,
  validarClienteId,
} = require('../src/validaciones/admin');
const { uuidObligatorio, productoIdValido } = require('../src/validaciones/comunes');

const CLIENTE_ID = '11111111-1111-4111-8111-111111111111';

function fechaFutura() {
  const fecha = new Date();
  fecha.setUTCDate(fecha.getUTCDate() + 1);
  return fecha.toISOString().slice(0, 10);
}

test('registro válido normaliza el correo y no devuelve errores', () => {
  const { campos, datos } = validarRegistro({
    nombre: 'Mia Paola',
    email: 'Mia@Ejemplo.COM',
    password: 'secreto123',
  });
  assert.deepEqual(campos, {});
  assert.equal(datos.email, 'mia@ejemplo.com');
  assert.equal(datos.nombre, 'Mia Paola');
});

test('registro rechaza la propiedad rol', () => {
  const { campos } = validarRegistro({
    nombre: 'Mia',
    email: 'mia@ejemplo.com',
    password: 'secreto123',
    rol: 'administrador',
  });
  assert.equal(campos.rol, 'No está permitido asignar roles desde el registro');
});

test('registro exige nombre, correo y contraseña válidos', () => {
  const { campos } = validarRegistro({ nombre: '', email: 'no-es-correo', password: 'corta' });
  assert.ok(campos.nombre);
  assert.equal(campos.email, 'El correo no tiene un formato válido');
  assert.ok(campos.password);
});

test('login exige correo con formato y contraseña', () => {
  const { campos } = validarLogin({ email: 'sin-arroba', password: '' });
  assert.equal(campos.email, 'El correo no tiene un formato válido');
  assert.ok(campos.password);
});

test('venta válida pasa las validaciones con producto de catálogo', () => {
  const { campos, datos } = validarCreacionVenta({
    fecha: '2026-01-15',
    producto_id: 'B003',
    cantidad: 2,
    precio_unitario_mxn: 31,
  });
  assert.deepEqual(campos, {});
  assert.deepEqual(datos, {
    fecha: '2026-01-15',
    productoId: 'B003',
    cantidad: 2,
    precioUnitario: 31,
    claveIdempotencia: null,
  });
});

test('venta rechaza producto, cantidad y precio inválidos', () => {
  const { campos } = validarCreacionVenta({
    fecha: '2026-01-15',
    producto_id: 1.5,
    cantidad: 0,
    precio_unitario_mxn: -1,
  });
  assert.ok(campos.producto_id);
  assert.equal(campos.cantidad, 'La cantidad debe ser mayor o igual que 1');
  assert.equal(campos.precio_unitario_mxn, 'El precio unitario debe ser mayor que 0');
});

test('venta rechaza precio cero', () => {
  const { campos } = validarCreacionVenta({
    fecha: '2026-01-15',
    producto_id: 'B003',
    cantidad: 1,
    precio_unitario_mxn: 0,
  });
  assert.equal(campos.precio_unitario_mxn, 'El precio unitario debe ser mayor que 0');
});

test('venta rechaza fechas inválidas o futuras', () => {
  const invalida = validarCreacionVenta({
    fecha: '2026-13-01',
    producto_id: 'B003',
    cantidad: 1,
    precio_unitario_mxn: 5,
  });
  assert.equal(invalida.campos.fecha, 'La fecha no es válida');

  const futura = validarCreacionVenta({
    fecha: fechaFutura(),
    producto_id: 'B003',
    cantidad: 1,
    precio_unitario_mxn: 5,
  });
  assert.equal(futura.campos.fecha, 'La fecha no puede ser futura');
});

test('venta rechaza que el cliente fije propietario, importación u origen', () => {
  const { campos } = validarCreacionVenta({
    fecha: '2026-01-15',
    producto_id: 'B003',
    cantidad: 1,
    precio_unitario_mxn: 5,
    propietario_id: CLIENTE_ID,
    usuario_id: CLIENTE_ID,
    importacion_id: 1,
    id_origen: 'D01-066',
  });
  assert.ok(campos.propietario_id);
  assert.ok(campos.usuario_id);
  assert.ok(campos.importacion_id);
  assert.ok(campos.id_origen);
});

test('la clave de idempotencia debe ser UUID si se envía', () => {
  const { campos } = validarCreacionVenta({
    fecha: '2026-01-15',
    producto_id: 'B003',
    cantidad: 1,
    precio_unitario_mxn: 5,
    clave_idempotencia: 'no-uuid',
  });
  assert.ok(campos.clave_idempotencia);
});

test('total declarado correcto no genera error y uno incorrecto sí', () => {
  const camposCorrecto = {};
  validarTotalDeclarado(62, 31, 2, camposCorrecto);
  assert.deepEqual(camposCorrecto, {});

  const camposIncorrecto = {};
  validarTotalDeclarado(60, 31, 2, camposIncorrecto);
  assert.equal(camposIncorrecto.total_mxn, 'El total no coincide con precio unitario × cantidad');
});

test('rango de fechas valida orden y máximo de días', () => {
  const invertido = validarRangoFechas({ desde: '2026-05-02', hasta: '2026-05-01' });
  assert.ok(invertido.campos.desde);

  const excesivo = validarRangoFechas({ desde: '2024-01-01', hasta: '2026-06-01' });
  assert.ok(excesivo.campos.rango);

  const valido = validarRangoFechas({ desde: '2026-01-01', hasta: '2026-03-01' });
  assert.deepEqual(valido.campos, {});
});

test('paginación usa valores por defecto y valida límites', () => {
  assert.deepEqual(validarPaginacion({}).campos, {});
  assert.deepEqual(validarPaginacion({}).paginacion, { limite: 100, desplazamiento: 0 });
  assert.deepEqual(validarPaginacion({ limite: '25', desplazamiento: '5' }).paginacion, {
    limite: 25,
    desplazamiento: 5,
  });
  assert.ok(validarPaginacion({ limite: 0 }).campos.limite);
  assert.ok(validarPaginacion({ limite: 501 }).campos.limite);
  assert.ok(validarPaginacion({ desplazamiento: -1 }).campos.desplazamiento);
});

test('cambio de rol solo admite valores conocidos', () => {
  assert.deepEqual(validarCambioRol({ rol: 'administrador' }).campos, {});
  assert.ok(validarCambioRol({}).campos.rol);
  assert.ok(validarCambioRol({ rol: 'superadmin' }).campos.rol);
});

test('agrupación usa semana por defecto y solo admite semana o mes', () => {
  assert.deepEqual(validarAgrupacion('semana'), { campos: {}, agrupacion: 'semana' });
  assert.deepEqual(validarAgrupacion('mes'), { campos: {}, agrupacion: 'mes' });
  assert.deepEqual(validarAgrupacion(undefined), { campos: {}, agrupacion: 'semana' });
  assert.ok(validarAgrupacion('dia').campos.agrupacion);
});

test('el cliente administrativo debe ser UUID', () => {
  assert.deepEqual(validarClienteId(CLIENTE_ID), {
    campos: {},
    clienteId: CLIENTE_ID,
  });
  assert.ok(validarClienteId('no-uuid').campos.cliente_id);
  assert.ok(validarClienteId(undefined).campos.cliente_id);
});

test('UUID y producto usan los patrones del esquema acordado', () => {
  const campos = {};
  assert.equal(uuidObligatorio(CLIENTE_ID, 'id', campos), CLIENTE_ID);
  assert.deepEqual(campos, {});

  const camposUuid = {};
  assert.equal(uuidObligatorio('abc', 'id', camposUuid), null);
  assert.ok(camposUuid.id);

  assert.equal(productoIdValido('B003', 'producto_id', {}), 'B003');
  assert.equal(productoIdValido('AB003', 'producto_id', {}), 'AB003');
  assert.equal(productoIdValido('b003', 'producto_id', {}), null);
  assert.equal(productoIdValido('B0034', 'producto_id', {}), null);
});

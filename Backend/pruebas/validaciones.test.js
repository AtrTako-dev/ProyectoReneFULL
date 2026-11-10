const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validarRegistro, validarLogin } = require('../src/validaciones/auth');
const {
  validarCreacionVenta,
  validarTotalDeclarado,
  validarRangoFechas,
  validarHorizonte,
} = require('../src/validaciones/ventas');
const { validarCambioRol, validarAgrupacion } = require('../src/validaciones/admin');

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

test('venta válida pasa las validaciones', () => {
  const { campos, datos } = validarCreacionVenta({
    fecha: '2026-01-15',
    producto_id: 3,
    cantidad: 2,
    precio_unitario_mxn: 10.5,
  });
  assert.deepEqual(campos, {});
  assert.deepEqual(datos, { fecha: '2026-01-15', productoId: 3, cantidad: 2, precioUnitario: 10.5 });
});

test('venta rechaza producto, cantidad y precio inválidos', () => {
  const { campos } = validarCreacionVenta({
    fecha: '2026-01-15',
    producto_id: 1.5,
    cantidad: 0,
    precio_unitario_mxn: -1,
  });
  assert.ok(campos.producto_id);
  assert.equal(campos.cantidad, 'La cantidad debe ser mayor que 0');
  assert.equal(campos.precio_unitario_mxn, 'El precio unitario no puede ser negativo');
});

test('venta rechaza precio cero', () => {
  const { campos } = validarCreacionVenta({
    fecha: '2026-01-15',
    producto_id: 1,
    cantidad: 1,
    precio_unitario_mxn: 0,
  });
  assert.equal(campos.precio_unitario_mxn, 'El precio unitario debe ser mayor que 0');
});

test('venta rechaza fechas inválidas o futuras', () => {
  const invalida = validarCreacionVenta({
    fecha: '2026-13-01',
    producto_id: 1,
    cantidad: 1,
    precio_unitario_mxn: 5,
  });
  assert.equal(invalida.campos.fecha, 'La fecha no es válida');

  const futura = validarCreacionVenta({
    fecha: fechaFutura(),
    producto_id: 1,
    cantidad: 1,
    precio_unitario_mxn: 5,
  });
  assert.equal(futura.campos.fecha, 'La fecha no puede ser futura');
});

test('total declarado correcto no genera error y uno incorrecto sí', () => {
  const camposCorrecto = {};
  validarTotalDeclarado(21, 10.5, 2, camposCorrecto);
  assert.deepEqual(camposCorrecto, {});

  const camposIncorrecto = {};
  validarTotalDeclarado(20, 10.5, 2, camposIncorrecto);
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

test('horizonte debe ser entero entre 1 y 90', () => {
  assert.ok(validarHorizonte(undefined).campos.horizonte);
  assert.equal(validarHorizonte(0).campos.horizonte, 'El horizonte debe ser mayor que 0');
  assert.equal(validarHorizonte(91).campos.horizonte, 'El horizonte no puede superar 90 días');
  assert.ok(validarHorizonte('abc').campos.horizonte);
  assert.deepEqual(validarHorizonte('7').campos, {});
});

test('cambio de rol solo admite valores conocidos', () => {
  assert.deepEqual(validarCambioRol({ rol: 'administrador' }).campos, {});
  assert.ok(validarCambioRol({}).campos.rol);
  assert.ok(validarCambioRol({ rol: 'superadmin' }).campos.rol);
});

test('agrupación solo admite semana o mes', () => {
  assert.deepEqual(validarAgrupacion('semana').campos, {});
  assert.deepEqual(validarAgrupacion('mes').campos, {});
  assert.ok(validarAgrupacion('dia').campos.agrupacion);
  assert.ok(validarAgrupacion(undefined).campos.agrupacion);
});

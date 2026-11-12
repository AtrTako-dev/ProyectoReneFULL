process.env.NODE_ENV = 'test';
process.env.JWT_SECRETO = 'secreto-de-pruebas-para-tokens-1234567890';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');
const usuarioModelo = require('../src/modelos/usuarioModelo');
const ventaModelo = require('../src/modelos/ventaModelo');
const productoModelo = require('../src/modelos/productoModelo');
const { firmarToken } = require('../src/servicios/token');
const { hashear } = require('../src/servicios/password');

const CLIENTE_ID = '11111111-1111-4111-8111-111111111111';
const OTRO_CLIENTE_ID = '22222222-2222-4222-8222-222222222222';
const ADMIN_ID = '33333333-3333-4333-8333-333333333333';
const CLIENTE_INACTIVO_ID = '44444444-4444-4444-8444-444444444444';
const CLAVE_IDEMPOTENCIA = '55555555-5555-4555-8555-555555555555';

let servidor;
let base;

before(async () => {
  servidor = app.listen(0);
  await new Promise((resolve) => servidor.once('listening', resolve));
  base = `http://127.0.0.1:${servidor.address().port}`;
});

after(() => new Promise((resolve) => servidor.close(resolve)));

async function pedir(ruta, { metodo = 'GET', token, cuerpo } = {}) {
  const encabezados = {};
  if (cuerpo !== undefined) {
    encabezados['content-type'] = 'application/json';
  }
  if (token) {
    encabezados.authorization = `Bearer ${token}`;
  }
  const respuesta = await fetch(`${base}${ruta}`, {
    method: metodo,
    headers: encabezados,
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const datos = await respuesta.json();
  return { estado: respuesta.status, cuerpo: datos };
}

function cliente(extra = {}) {
  return {
    id: CLIENTE_ID,
    nombre: 'Mia Paola',
    correo: 'mia@ejemplo.com',
    rol: 'cliente',
    activo: 1,
    ...extra,
  };
}

function administrador(extra = {}) {
  return {
    id: ADMIN_ID,
    nombre: 'Administrador',
    correo: 'admin@ejemplo.com',
    rol: 'administrador',
    activo: 1,
    ...extra,
  };
}

function filaVenta(extra = {}) {
  return {
    id: 1,
    propietario_id: CLIENTE_ID,
    fecha: '2026-01-15',
    producto_id: 'B003',
    producto: 'Jugo de naranja 1 L',
    categoria: 'Bebidas',
    precio_unitario_mxn: 31,
    cantidad: 4,
    total_mxn: 124,
    importacion_id: null,
    id_origen: null,
    es_demostracion: 0,
    ...extra,
  };
}

function tokenCliente() {
  return firmarToken(CLIENTE_ID);
}

test('el registro público crea siempre un cliente y devuelve sesión', async (t) => {
  let argumentos;
  t.mock.method(usuarioModelo, 'buscarPorCorreo', async () => null);
  t.mock.method(usuarioModelo, 'crear', async (datos) => {
    argumentos = datos;
    return {
      id: CLIENTE_ID,
      nombre: datos.nombre,
      correo: datos.correo,
      rol: datos.rol,
      activo: 1,
    };
  });

  const { estado, cuerpo } = await pedir('/api/auth/registro', {
    metodo: 'POST',
    cuerpo: {
      nombre: '  Mia Paola  ',
      email: 'Mia@Ejemplo.COM',
      password: 'secreto123',
    },
  });

  assert.equal(estado, 201);
  assert.equal(cuerpo.usuario.correo, 'mia@ejemplo.com');
  assert.equal(cuerpo.usuario.rol, 'cliente');
  assert.equal(cuerpo.usuario.activo, true);
  assert.equal(cuerpo.usuario.email, undefined);
  assert.match(cuerpo.token, /^[\w-]+\.[\w-]+\.[\w-]+$/);
  assert.equal(argumentos.nombre, 'Mia Paola');
  assert.equal(argumentos.correo, 'mia@ejemplo.com');
  assert.equal(argumentos.rol, 'cliente');
  assert.match(argumentos.contrasenaHash, /^\$argon2id\$/);
});

test('el registro duplicado responde 409 sin exponer detalles', async (t) => {
  t.mock.method(usuarioModelo, 'buscarPorCorreo', async () => cliente());

  const { estado, cuerpo } = await pedir('/api/auth/registro', {
    metodo: 'POST',
    cuerpo: { nombre: 'Mia', email: 'mia@ejemplo.com', password: 'secreto123' },
  });

  assert.equal(estado, 409);
  assert.equal(cuerpo.error.codigo, 'CONFLICTO');
  assert.equal(cuerpo.error.mensaje, 'El correo ya está registrado.');
});

test('el registro traduce una carrera de correo duplicado en MySQL a 409', async (t) => {
  t.mock.method(usuarioModelo, 'buscarPorCorreo', async () => null);
  t.mock.method(usuarioModelo, 'crear', async () => {
    const error = new Error('duplicado');
    error.code = 'ER_DUP_ENTRY';
    throw error;
  });

  const { estado, cuerpo } = await pedir('/api/auth/registro', {
    metodo: 'POST',
    cuerpo: { nombre: 'Mia', email: 'mia@ejemplo.com', password: 'secreto123' },
  });

  assert.equal(estado, 409);
  assert.equal(cuerpo.error.codigo, 'CONFLICTO');
});

test('login distingue credenciales incorrectas de una sesión válida', async (t) => {
  const hash = await hashear('secreto123');
  t.mock.method(usuarioModelo, 'buscarPorCorreo', async () => ({
    ...cliente(),
    password_hash: hash,
  }));

  const incorrecto = await pedir('/api/auth/login', {
    metodo: 'POST',
    cuerpo: { email: 'mia@ejemplo.com', password: 'incorrecta' },
  });
  assert.equal(incorrecto.estado, 401);
  assert.equal(incorrecto.cuerpo.error.mensaje, 'Correo o contraseña incorrectos.');

  const correcto = await pedir('/api/auth/login', {
    metodo: 'POST',
    cuerpo: { email: 'Mia@Ejemplo.com', password: 'secreto123' },
  });
  assert.equal(correcto.estado, 200);
  assert.equal(correcto.cuerpo.usuario.correo, 'mia@ejemplo.com');
  assert.ok(correcto.cuerpo.token);
});

test('una cuenta inactiva no puede iniciar sesión', async (t) => {
  const hash = await hashear('secreto123');
  t.mock.method(usuarioModelo, 'buscarPorCorreo', async () => ({
    ...cliente({ activo: 0 }),
    password_hash: hash,
  }));

  const { estado, cuerpo } = await pedir('/api/auth/login', {
    metodo: 'POST',
    cuerpo: { email: 'mia@ejemplo.com', password: 'secreto123' },
  });

  assert.equal(estado, 401);
  assert.equal(cuerpo.error.mensaje, 'Correo o contraseña incorrectos.');
});

test('GET /me devuelve el usuario vigente resuelto desde la base', async (t) => {
  t.mock.method(usuarioModelo, 'buscarPorId', async (id) => (id === CLIENTE_ID ? cliente() : null));

  const { estado, cuerpo } = await pedir('/api/auth/me', { token: tokenCliente() });

  assert.equal(estado, 200);
  assert.equal(cuerpo.usuario.correo, 'mia@ejemplo.com');
});

test('una cuenta desactivada pierde el acceso aunque su token siga vigente', async (t) => {
  t.mock.method(usuarioModelo, 'buscarPorId', async () =>
    cliente({ id: CLIENTE_INACTIVO_ID, activo: 0 })
  );
  const token = firmarToken(CLIENTE_INACTIVO_ID);

  const { estado, cuerpo } = await pedir('/api/auth/me', { token });

  assert.equal(estado, 401);
  assert.equal(cuerpo.error.codigo, 'NO_AUTENTICADO');
});

test('un cliente recibe 403 directo en rutas administrativas', async (t) => {
  t.mock.method(usuarioModelo, 'buscarPorId', async () => cliente());
  const listar = t.mock.method(usuarioModelo, 'listar', async () => []);

  const { estado, cuerpo } = await pedir('/api/admin/usuarios', { token: tokenCliente() });

  assert.equal(estado, 403);
  assert.equal(cuerpo.error.codigo, 'NO_AUTORIZADO');
  assert.equal(listar.mock.callCount(), 0);
});

test('un administrador vigente consulta usuarios', async (t) => {
  t.mock.method(usuarioModelo, 'buscarPorId', async (id) =>
    id === ADMIN_ID ? administrador() : null
  );
  t.mock.method(usuarioModelo, 'listar', async () => [
    { ...administrador(), creado_en: '2026-01-01', actualizado_en: '2026-01-01' },
    { ...cliente(), creado_en: '2026-01-02', actualizado_en: '2026-01-02' },
  ]);

  const { estado, cuerpo } = await pedir('/api/admin/usuarios', {
    token: firmarToken(ADMIN_ID),
  });

  assert.equal(estado, 200);
  assert.equal(cuerpo.usuarios.length, 2);
  assert.equal(cuerpo.usuarios[1].correo, 'mia@ejemplo.com');
});

test('un administrador no puede modificar su propio rol', async (t) => {
  t.mock.method(usuarioModelo, 'buscarPorId', async () => administrador());
  const actualizar = t.mock.method(usuarioModelo, 'actualizarRol', async () => {
    throw new Error('no debería actualizar');
  });

  const { estado, cuerpo } = await pedir(`/api/admin/usuarios/${ADMIN_ID}/rol`, {
    metodo: 'PATCH',
    token: firmarToken(ADMIN_ID),
    cuerpo: { rol: 'cliente' },
  });

  assert.equal(estado, 403);
  assert.equal(cuerpo.error.codigo, 'NO_AUTORIZADO');
  assert.equal(actualizar.mock.callCount(), 0);
});

test('un administrador promueve a otro usuario y devuelve el usuario actualizado', async (t) => {
  t.mock.method(usuarioModelo, 'buscarPorId', async (id) => {
    if (id === ADMIN_ID) return administrador();
    if (id === CLIENTE_ID) return cliente();
    return null;
  });
  t.mock.method(usuarioModelo, 'actualizarRol', async (id, rol) => cliente({ rol }));

  const { estado, cuerpo } = await pedir(`/api/admin/usuarios/${CLIENTE_ID}/rol`, {
    metodo: 'PATCH',
    token: firmarToken(ADMIN_ID),
    cuerpo: { rol: 'administrador' },
  });

  assert.equal(estado, 200);
  assert.equal(cuerpo.usuario.rol, 'administrador');
  assert.equal(cuerpo.usuario.correo, 'mia@ejemplo.com');
});

test('un id administrativo que no es UUID responde 404 sin consultar la base', async (t) => {
  t.mock.method(usuarioModelo, 'buscarPorId', async () => administrador());
  const actualizar = t.mock.method(usuarioModelo, 'actualizarRol', async () => null);

  const { estado, cuerpo } = await pedir('/api/admin/usuarios/7/rol', {
    metodo: 'PATCH',
    token: firmarToken(ADMIN_ID),
    cuerpo: { rol: 'administrador' },
  });

  assert.equal(estado, 404);
  assert.equal(cuerpo.error.codigo, 'NO_ENCONTRADO');
  assert.equal(actualizar.mock.callCount(), 0);
});

test('el listado de ventas propias usa el propietario del token, no la URL', async (t) => {
  t.mock.method(usuarioModelo, 'buscarPorId', async () => cliente());
  let propietarioConsultado;
  t.mock.method(ventaModelo, 'listarPaginaPorPropietario', async (propietarioId, rango, paginacion) => {
    propietarioConsultado = { propietarioId, rango, paginacion };
    return [filaVenta()];
  });
  t.mock.method(ventaModelo, 'contarPorPropietario', async () => 1);

  const { estado, cuerpo } = await pedir(
    `/api/ventas/mias?propietario_id=${OTRO_CLIENTE_ID}&limite=10`,
    { token: tokenCliente() }
  );

  assert.equal(estado, 200);
  assert.equal(propietarioConsultado.propietarioId, CLIENTE_ID);
  assert.equal(propietarioConsultado.paginacion.limite, 10);
  assert.equal(cuerpo.items.length, 1);
  assert.equal(cuerpo.items[0].propietario_id, CLIENTE_ID);
  assert.equal(cuerpo.total, 1);
});

test('las estadísticas propias filtran registros inválidos de MySQL', async (t) => {
  t.mock.method(usuarioModelo, 'buscarPorId', async () => cliente());
  t.mock.method(ventaModelo, 'listarPorPropietario', async () => [
    filaVenta(),
    filaVenta({ id: 2, cantidad: 1, total_mxn: 31, fecha: '2026-02-01' }),
    filaVenta({ id: 3, total_mxn: 999 }),
  ]);

  const { estado, cuerpo } = await pedir('/api/ventas/mias/estadisticas?agrupacion=mes', {
    token: tokenCliente(),
  });

  assert.equal(estado, 200);
  assert.equal(cuerpo.resumen.transacciones_validas, 2);
  assert.equal(cuerpo.resumen.registros_excluidos, 1);
  assert.equal(cuerpo.periodo.agrupacion, 'mes');
  assert.equal(cuerpo.por_mes.length, 2);
  assert.deepEqual(cuerpo.por_semana, []);
});

test('una agrupación inválida responde 422 antes de consultar ventas', async (t) => {
  t.mock.method(usuarioModelo, 'buscarPorId', async () => cliente());
  const listar = t.mock.method(ventaModelo, 'listarPorPropietario', async () => []);

  const { estado, cuerpo } = await pedir('/api/ventas/mias/estadisticas?agrupacion=dia', {
    token: tokenCliente(),
  });

  assert.equal(estado, 422);
  assert.ok(cuerpo.error.campos.agrupacion);
  assert.equal(listar.mock.callCount(), 0);
});

test('una venta creada calcula el total en el servidor y usa la sesión', async (t) => {
  t.mock.method(usuarioModelo, 'buscarPorId', async () => cliente());
  t.mock.method(productoModelo, 'buscarPorId', async () => ({
    producto_id: 'B003',
    producto: 'Jugo de naranja 1 L',
    categoria: 'Bebidas',
    precio_actual_mxn: '31.00',
    activo: 1,
  }));
  let insertada;
  t.mock.method(ventaModelo, 'insertar', async (datos) => {
    insertada = datos;
    return filaVenta({
      id: 9,
      propietario_id: datos.propietarioId,
      producto_id: datos.productoId,
      precio_unitario_mxn: datos.precioUnitarioMxn,
      cantidad: datos.cantidad,
      total_mxn: datos.totalMxn,
    });
  });

  const { estado, cuerpo } = await pedir('/api/ventas', {
    metodo: 'POST',
    token: tokenCliente(),
    cuerpo: {
      fecha: '2026-01-15',
      producto_id: 'B003',
      cantidad: 4,
      precio_unitario_mxn: 31,
    },
  });

  assert.equal(estado, 201);
  assert.equal(insertada.propietarioId, CLIENTE_ID);
  assert.equal(insertada.totalMxn, 124);
  assert.equal(cuerpo.venta.total_mxn, 124);
  assert.equal(cuerpo.venta.producto_id, 'B003');
});

test('una venta con total declarado incoherente responde 422 y no inserta', async (t) => {
  t.mock.method(usuarioModelo, 'buscarPorId', async () => cliente());
  t.mock.method(productoModelo, 'buscarPorId', async () => ({
    producto_id: 'B003',
    producto: 'Jugo de naranja 1 L',
    categoria: 'Bebidas',
    precio_actual_mxn: '31.00',
    activo: 1,
  }));
  const insertar = t.mock.method(ventaModelo, 'insertar', async () => filaVenta());

  const { estado, cuerpo } = await pedir('/api/ventas', {
    metodo: 'POST',
    token: tokenCliente(),
    cuerpo: {
      fecha: '2026-01-15',
      producto_id: 'B003',
      cantidad: 4,
      precio_unitario_mxn: 31,
      total_mxn: 100,
    },
  });

  assert.equal(estado, 422);
  assert.ok(cuerpo.error.campos.total_mxn);
  assert.equal(insertar.mock.callCount(), 0);
});

test('una venta con precio distinto al catálogo responde 422', async (t) => {
  t.mock.method(usuarioModelo, 'buscarPorId', async () => cliente());
  t.mock.method(productoModelo, 'buscarPorId', async () => ({
    producto_id: 'B003',
    producto: 'Jugo de naranja 1 L',
    categoria: 'Bebidas',
    precio_actual_mxn: '31.00',
    activo: 1,
  }));
  const insertar = t.mock.method(ventaModelo, 'insertar', async () => filaVenta());

  const { estado, cuerpo } = await pedir('/api/ventas', {
    metodo: 'POST',
    token: tokenCliente(),
    cuerpo: {
      fecha: '2026-01-15',
      producto_id: 'B003',
      cantidad: 4,
      precio_unitario_mxn: 30,
    },
  });

  assert.equal(estado, 422);
  assert.ok(cuerpo.error.campos.precio_unitario_mxn);
  assert.equal(insertar.mock.callCount(), 0);
});

test('una venta de un producto inexistente responde 404', async (t) => {
  t.mock.method(usuarioModelo, 'buscarPorId', async () => cliente());
  t.mock.method(productoModelo, 'buscarPorId', async () => null);

  const { estado, cuerpo } = await pedir('/api/ventas', {
    metodo: 'POST',
    token: tokenCliente(),
    cuerpo: {
      fecha: '2026-01-15',
      producto_id: 'B003',
      cantidad: 4,
      precio_unitario_mxn: 31,
    },
  });

  assert.equal(estado, 404);
  assert.equal(cuerpo.error.codigo, 'NO_ENCONTRADO');
});

test('la clave de idempotencia devuelve la venta existente sin duplicarla', async (t) => {
  t.mock.method(usuarioModelo, 'buscarPorId', async () => cliente());
  t.mock.method(productoModelo, 'buscarPorId', async () => ({
    producto_id: 'B003',
    producto: 'Jugo de naranja 1 L',
    categoria: 'Bebidas',
    precio_actual_mxn: '31.00',
    activo: 1,
  }));
  t.mock.method(ventaModelo, 'buscarPorClaveIdempotencia', async () =>
    filaVenta({ id: 12, id_origen: null })
  );
  const insertar = t.mock.method(ventaModelo, 'insertar', async () => filaVenta());

  const { estado, cuerpo } = await pedir('/api/ventas', {
    metodo: 'POST',
    token: tokenCliente(),
    cuerpo: {
      fecha: '2026-01-15',
      producto_id: 'B003',
      cantidad: 4,
      precio_unitario_mxn: 31,
      clave_idempotencia: CLAVE_IDEMPOTENCIA,
    },
  });

  assert.equal(estado, 200);
  assert.equal(cuerpo.venta.id, 12);
  assert.equal(insertar.mock.callCount(), 0);
});

test('una carrera de idempotencia en MySQL devuelve la venta ya insertada', async (t) => {
  t.mock.method(usuarioModelo, 'buscarPorId', async () => cliente());
  t.mock.method(productoModelo, 'buscarPorId', async () => ({
    producto_id: 'B003',
    producto: 'Jugo de naranja 1 L',
    categoria: 'Bebidas',
    precio_actual_mxn: '31.00',
    activo: 1,
  }));
  let intentos = 0;
  t.mock.method(ventaModelo, 'buscarPorClaveIdempotencia', async () => {
    intentos += 1;
    return intentos === 1 ? null : filaVenta({ id: 13 });
  });
  t.mock.method(ventaModelo, 'insertar', async () => {
    const error = new Error('duplicado');
    error.code = 'ER_DUP_ENTRY';
    throw error;
  });

  const { estado, cuerpo } = await pedir('/api/ventas', {
    metodo: 'POST',
    token: tokenCliente(),
    cuerpo: {
      fecha: '2026-01-15',
      producto_id: 'B003',
      cantidad: 4,
      precio_unitario_mxn: 31,
      clave_idempotencia: CLAVE_IDEMPOTENCIA,
    },
  });

  assert.equal(estado, 200);
  assert.equal(cuerpo.venta.id, 13);
});

test('el cliente solo recibe predicciones de sus propias ventas', async (t) => {
  t.mock.method(usuarioModelo, 'buscarPorId', async () => cliente());
  let propietarioConsultado;
  t.mock.method(ventaModelo, 'listarPorPropietario', async (propietarioId) => {
    propietarioConsultado = propietarioId;
    return [];
  });

  const { estado, cuerpo } = await pedir('/api/ventas/mias/predicciones', {
    token: tokenCliente(),
  });

  assert.equal(estado, 200);
  assert.equal(propietarioConsultado, CLIENTE_ID);
  assert.deepEqual(cuerpo.predicciones, []);
});

test('con pocas ventas la predicción propia informa falta de historial sin inventar valores', async (t) => {
  t.mock.method(usuarioModelo, 'buscarPorId', async () => cliente());
  t.mock.method(ventaModelo, 'listarPorPropietario', async () => [
    filaVenta({ id: 1 }),
    filaVenta({ id: 2, fecha: '2026-01-22' }),
  ]);

  const { estado, cuerpo } = await pedir('/api/ventas/mias/predicciones', {
    token: tokenCliente(),
  });

  assert.equal(estado, 200);
  assert.equal(cuerpo.predicciones.length, 1);
  assert.equal(cuerpo.predicciones[0].tipo_resultado, 'sin_historial_suficiente');
  assert.equal(cuerpo.predicciones[0].valores, undefined);
});

test('las estadísticas administrativas agregan todas las ventas y clientes', async (t) => {
  t.mock.method(usuarioModelo, 'buscarPorId', async (id) =>
    id === ADMIN_ID ? administrador() : null
  );
  t.mock.method(ventaModelo, 'listarGlobal', async () => [
    filaVenta(),
    filaVenta({ id: 2, propietario_id: OTRO_CLIENTE_ID, cantidad: 1, total_mxn: 31 }),
  ]);
  t.mock.method(usuarioModelo, 'listar', async () => [
    cliente(),
    cliente({ id: OTRO_CLIENTE_ID, nombre: 'Luis', correo: 'luis@ejemplo.com' }),
  ]);

  const { estado, cuerpo } = await pedir('/api/admin/estadisticas/ventas', {
    token: firmarToken(ADMIN_ID),
  });

  assert.equal(estado, 200);
  assert.equal(cuerpo.resumen.transacciones_validas, 2);
  assert.equal(cuerpo.resumen.unidades, 5);
  assert.equal(cuerpo.resumen.total_clientes, 2);
  assert.equal(cuerpo.clientes.length, 2);
});

test('la predicción administrativa exige un cliente UUID existente', async (t) => {
  t.mock.method(usuarioModelo, 'buscarPorId', async (id) =>
    id === ADMIN_ID ? administrador() : id === CLIENTE_ID ? cliente() : null
  );

  const sinCliente = await pedir('/api/admin/predicciones/demanda', {
    token: firmarToken(ADMIN_ID),
  });
  assert.equal(sinCliente.estado, 422);
  assert.ok(sinCliente.cuerpo.error.campos.cliente_id);

  const inexistente = await pedir(
    `/api/admin/predicciones/demanda?cliente_id=${OTRO_CLIENTE_ID}`,
    { token: firmarToken(ADMIN_ID) }
  );
  assert.equal(inexistente.estado, 404);
});

test('la predicción administrativa devuelve el cliente y sus predicciones', async (t) => {
  t.mock.method(usuarioModelo, 'buscarPorId', async (id) =>
    id === ADMIN_ID ? administrador() : id === CLIENTE_ID ? cliente() : null
  );
  t.mock.method(ventaModelo, 'listarPorPropietario', async (propietarioId) => {
    assert.equal(propietarioId, CLIENTE_ID);
    return [];
  });

  const { estado, cuerpo } = await pedir(
    `/api/admin/predicciones/demanda?cliente_id=${CLIENTE_ID}`,
    { token: firmarToken(ADMIN_ID) }
  );

  assert.equal(estado, 200);
  assert.equal(cuerpo.cliente.correo, 'mia@ejemplo.com');
  assert.deepEqual(cuerpo.predicciones, []);
});

test('un fallo de conexión a MySQL responde 500 sin filtrar detalles internos', async (t) => {
  t.mock.method(usuarioModelo, 'buscarPorCorreo', async () => {
    const error = new Error('ECONNREFUSED 127.0.0.1 usuario=root password=secreto');
    error.code = 'ECONNREFUSED';
    throw error;
  });

  const { estado, cuerpo } = await pedir('/api/auth/login', {
    metodo: 'POST',
    cuerpo: { email: 'mia@ejemplo.com', password: 'secreto123' },
  });

  assert.equal(estado, 500);
  assert.equal(cuerpo.error.codigo, 'ERROR_INTERNO');
  assert.equal(JSON.stringify(cuerpo).includes('ECONNREFUSED'), false);
  assert.equal(JSON.stringify(cuerpo).includes('secreto'), false);
});

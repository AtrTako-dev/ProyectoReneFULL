const crypto = require('node:crypto');
const { configuracion } = require('./config/entorno');

const API_BASE_URL = (process.env.API_BASE_URL || `http://127.0.0.1:${configuracion.puerto}`).replace(/\/+$/, '');
const PRODUCTO_PRUEBA = { producto_id: 'B003', precio_unitario_mxn: 31 };

async function solicitar(ruta, { metodo = 'GET', token, cuerpo } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (cuerpo !== undefined) headers['content-type'] = 'application/json';

  const respuesta = await fetch(`${API_BASE_URL}${ruta}`, {
    method: metodo,
    headers,
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    signal: AbortSignal.timeout(10000),
  });
  let datos = null;
  try {
    datos = await respuesta.json();
  } catch {
    // Los errores se reportan por estado HTTP sin mostrar cuerpos inesperados.
  }
  return { estado: respuesta.status, datos };
}

function comprobar(nombre, resultado, estadoEsperado, validar = () => true) {
  const codigo = resultado.datos?.error?.codigo;
  if (resultado.estado !== estadoEsperado || !validar(resultado.datos)) {
    throw new Error(`${nombre}: se esperaba HTTP ${estadoEsperado} y se recibió HTTP ${resultado.estado}${codigo ? ` (${codigo})` : ''}.`);
  }
  console.log(`OK ${nombre}: HTTP ${resultado.estado}`);
  return resultado.datos;
}

async function principal() {
  if (configuracion.entorno === 'production') {
    throw new Error('La prueba de humo no se puede ejecutar con NODE_ENV=production.');
  }
  if (!configuracion.admin.email || !configuracion.admin.contrasena) {
    throw new Error('Configura ADMIN_EMAIL y ADMIN_CONTRASENA en Backend/.env para probar las rutas administrativas.');
  }

  const idUnico = crypto.randomUUID();
  const correo = `humo-${idUnico}@example.com`;
  const nombre = `Prueba de humo ${idUnico.slice(0, 8)}`;
  const contrasena = crypto.randomBytes(24).toString('base64url');
  const idUnicoSecundario = crypto.randomUUID();
  const correoSecundario = `humo-${idUnicoSecundario}@example.com`;
  const nombreSecundario = `Prueba secundaria ${idUnicoSecundario.slice(0, 8)}`;
  const contrasenaSecundaria = crypto.randomBytes(24).toString('base64url');
  const cuerpoRegistro = { nombre, email: correo, password: contrasena };
  const cuerpoRegistroSecundario = {
    nombre: nombreSecundario,
    email: correoSecundario,
    password: contrasenaSecundaria,
  };
  const claveIdempotencia = crypto.randomUUID();
  const claveIdempotenciaSecundaria = crypto.randomUUID();
  const fecha = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  let tokenAdministrador;
  let usuarioId;
  let usuarioPromovido = false;

  try {
    comprobar('GET /api/salud', await solicitar('/api/salud'), 200,
      (datos) => datos?.estado === 'ok');

    const registro = comprobar('POST /api/auth/registro', await solicitar('/api/auth/registro', {
      metodo: 'POST', cuerpo: cuerpoRegistro,
    }), 201, (datos) => Boolean(datos?.usuario?.id && datos?.token));
    usuarioId = registro.usuario.id;

    const registroSecundario = comprobar('registro de segundo cliente', await solicitar('/api/auth/registro', {
      metodo: 'POST', cuerpo: cuerpoRegistroSecundario,
    }), 201, (datos) => Boolean(datos?.usuario?.id && datos?.token && datos.usuario.rol === 'cliente'));
    const usuarioIdSecundario = registroSecundario.usuario.id;

    comprobar('registro con rol rechazado', await solicitar('/api/auth/registro', {
      metodo: 'POST', cuerpo: { ...cuerpoRegistro, rol: 'administrador' },
    }), 422, (datos) => Boolean(datos?.error?.campos?.rol));

    comprobar('registro repetido', await solicitar('/api/auth/registro', {
      metodo: 'POST', cuerpo: cuerpoRegistro,
    }), 409);

    const sesion = comprobar('POST /api/auth/login', await solicitar('/api/auth/login', {
      metodo: 'POST', cuerpo: { email: correo, password: contrasena },
    }), 200, (datos) => Boolean(datos?.token));
    const tokenCliente = sesion.token;

    comprobar('login con contraseña incorrecta', await solicitar('/api/auth/login', {
      metodo: 'POST', cuerpo: { email: correo, password: `${contrasena}incorrecta` },
    }), 401);

    comprobar('GET /api/auth/me con token', await solicitar('/api/auth/me', {
      token: tokenCliente,
    }), 200, (datos) => datos?.usuario?.id === usuarioId);
    comprobar('GET /api/auth/me sin token', await solicitar('/api/auth/me'), 401);

    const cuerpoVenta = {
      fecha,
      producto_id: PRODUCTO_PRUEBA.producto_id,
      cantidad: 1,
      precio_unitario_mxn: PRODUCTO_PRUEBA.precio_unitario_mxn,
      clave_idempotencia: claveIdempotencia,
    };
    const venta = comprobar('POST /api/ventas', await solicitar('/api/ventas', {
      metodo: 'POST', token: tokenCliente, cuerpo: cuerpoVenta,
    }), 201, (datos) => Boolean(datos?.venta?.id));

    const ventaReintentada = comprobar('POST /api/ventas repetida con idempotencia', await solicitar('/api/ventas', {
      metodo: 'POST', token: tokenCliente, cuerpo: cuerpoVenta,
    }), 200, (datos) => String(datos?.venta?.id) === String(venta.venta.id));
    if (String(ventaReintentada.venta.id) !== String(venta.venta.id)) {
      throw new Error('La repetición idempotente devolvió una venta distinta.');
    }

    const ventaSecundaria = comprobar('POST /api/ventas de segundo cliente', await solicitar('/api/ventas', {
      metodo: 'POST', token: registroSecundario.token, cuerpo: {
        fecha,
        producto_id: PRODUCTO_PRUEBA.producto_id,
        cantidad: 1,
        precio_unitario_mxn: PRODUCTO_PRUEBA.precio_unitario_mxn,
        clave_idempotencia: claveIdempotenciaSecundaria,
      },
    }), 201, (datos) => Boolean(datos?.venta?.id));

    const ventasPrimerCliente = comprobar('GET /api/ventas/mias del primer cliente', await solicitar(
      `/api/ventas/mias?desde=${fecha}&hasta=${fecha}`,
      { token: tokenCliente }
    ), 200, (datos) => Array.isArray(datos?.items) &&
      datos.items.some((item) => String(item.id) === String(venta.venta.id)) &&
      !datos.items.some((item) => String(item.id) === String(ventaSecundaria.venta.id)));
    if (ventasPrimerCliente.items.filter((item) => String(item.id) === String(venta.venta.id)).length !== 1) {
      throw new Error('El primer cliente recibió ventas duplicadas al repetir la clave de idempotencia.');
    }
    comprobar('GET /api/ventas/mias del segundo cliente', await solicitar(
      `/api/ventas/mias?desde=${fecha}&hasta=${fecha}`,
      { token: registroSecundario.token }
    ), 200, (datos) => Array.isArray(datos?.items) &&
      datos.items.some((item) => String(item.id) === String(ventaSecundaria.venta.id)) &&
      !datos.items.some((item) => String(item.id) === String(venta.venta.id)));

    comprobar('GET /api/ventas/mias/estadisticas', await solicitar(`/api/ventas/mias/estadisticas?desde=${fecha}&hasta=${fecha}`, {
      token: tokenCliente,
    }), 200);
    comprobar('GET /api/ventas/mias/predicciones', await solicitar('/api/ventas/mias/predicciones', {
      token: tokenCliente,
    }), 200, (datos) => Array.isArray(datos?.predicciones) &&
      datos.predicciones.length > 0 &&
      datos.predicciones.every((prediccion) => prediccion.tipo_resultado === 'sin_historial_suficiente'));

    comprobar('cliente bloqueado en /api/admin/usuarios', await solicitar('/api/admin/usuarios', {
      token: tokenCliente,
    }), 403);
    comprobar('cliente bloqueado en PATCH /api/admin/usuarios/{id}/rol', await solicitar(
      `/api/admin/usuarios/${usuarioIdSecundario}/rol`,
      { metodo: 'PATCH', token: tokenCliente, cuerpo: { rol: 'administrador' } }
    ), 403);
    comprobar('cliente bloqueado en /api/admin/estadisticas/ventas', await solicitar(
      `/api/admin/estadisticas/ventas?desde=${fecha}&hasta=${fecha}`,
      { token: tokenCliente }
    ), 403);
    comprobar('cliente bloqueado en /api/admin/predicciones/demanda', await solicitar(
      `/api/admin/predicciones/demanda?cliente_id=${usuarioId}`,
      { token: tokenCliente }
    ), 403);

    const sesionAdministrador = comprobar('login administrador', await solicitar('/api/auth/login', {
      metodo: 'POST',
      cuerpo: { email: configuracion.admin.email, password: configuracion.admin.contrasena },
    }), 200, (datos) => datos?.usuario?.rol === 'administrador' && Boolean(datos?.token));
    tokenAdministrador = sesionAdministrador.token;
    const idAdministrador = sesionAdministrador.usuario.id;

    comprobar('GET /api/admin/usuarios con administrador', await solicitar('/api/admin/usuarios', {
      token: tokenAdministrador,
    }), 200, (datos) => Array.isArray(datos?.usuarios));
    comprobar('GET /api/admin/estadisticas/ventas con administrador', await solicitar(
      `/api/admin/estadisticas/ventas?desde=${fecha}&hasta=${fecha}`,
      { token: tokenAdministrador }
    ), 200, (datos) => Array.isArray(datos?.clientes) && Boolean(datos?.resumen));
    comprobar('GET /api/admin/predicciones/demanda con administrador', await solicitar(
      `/api/admin/predicciones/demanda?cliente_id=${usuarioId}`,
      { token: tokenAdministrador }
    ), 200, (datos) => datos?.cliente?.id === usuarioId &&
      Array.isArray(datos?.predicciones) &&
      datos.predicciones.some((prediccion) => prediccion.tipo_resultado === 'sin_historial_suficiente'));

    const promocion = await solicitar(`/api/admin/usuarios/${usuarioId}/rol`, {
      metodo: 'PATCH', token: tokenAdministrador, cuerpo: { rol: 'administrador' },
    });
    if (promocion.estado === 200) usuarioPromovido = true;
    comprobar('PATCH promoción a administrador', promocion, 200,
      (datos) => datos?.usuario?.rol === 'administrador');

    comprobar('PATCH intento de cambiar el propio rol', await solicitar(`/api/admin/usuarios/${idAdministrador}/rol`, {
      metodo: 'PATCH', token: tokenAdministrador, cuerpo: { rol: 'cliente' },
    }), 403);

    console.log(`Cuentas de prueba: ${correo}, ${correoSecundario}`);
    console.log(`Ventas de prueba: ${venta.venta.id}, ${ventaSecundaria.venta.id}`);
  } finally {
    if (usuarioPromovido && tokenAdministrador && usuarioId) {
      comprobar('restaurar rol de la cuenta de prueba', await solicitar(`/api/admin/usuarios/${usuarioId}/rol`, {
        metodo: 'PATCH', token: tokenAdministrador, cuerpo: { rol: 'cliente' },
      }), 200, (datos) => datos?.usuario?.rol === 'cliente');
    }
  }

  console.log('Prueba de humo completada. Las cuentas y ventas de prueba permanecen en la base de desarrollo.');
}

if (require.main === module) {
  principal().catch((error) => {
    console.error(`Prueba de humo fallida: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { principal };

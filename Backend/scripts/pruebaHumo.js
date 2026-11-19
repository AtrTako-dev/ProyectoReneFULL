const crypto = require('node:crypto');
const { configuracion } = require('../src/config/entorno');

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
  const cuerpoRegistro = { nombre, email: correo, password: contrasena };
  const claveIdempotencia = crypto.randomUUID();
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

    comprobar('GET /api/ventas/mias', await solicitar(`/api/ventas/mias?desde=${fecha}&hasta=${fecha}`, {
      token: tokenCliente,
    }), 200, (datos) => Array.isArray(datos?.items) && datos.items.some((item) => String(item.id) === String(venta.venta.id)));
    comprobar('GET /api/ventas/mias/estadisticas', await solicitar(`/api/ventas/mias/estadisticas?desde=${fecha}&hasta=${fecha}`, {
      token: tokenCliente,
    }), 200);
    comprobar('GET /api/ventas/mias/predicciones', await solicitar('/api/ventas/mias/predicciones', {
      token: tokenCliente,
    }), 200, (datos) => Array.isArray(datos?.predicciones));

    comprobar('cliente bloqueado en /api/admin/usuarios', await solicitar('/api/admin/usuarios', {
      token: tokenCliente,
    }), 403);

    const sesionAdministrador = comprobar('login administrador', await solicitar('/api/auth/login', {
      metodo: 'POST',
      cuerpo: { email: configuracion.admin.email, password: configuracion.admin.contrasena },
    }), 200, (datos) => datos?.usuario?.rol === 'administrador' && Boolean(datos?.token));
    tokenAdministrador = sesionAdministrador.token;
    const idAdministrador = sesionAdministrador.usuario.id;

    comprobar('GET /api/admin/usuarios con administrador', await solicitar('/api/admin/usuarios', {
      token: tokenAdministrador,
    }), 200, (datos) => Array.isArray(datos?.usuarios));

    const promocion = await solicitar(`/api/admin/usuarios/${usuarioId}/rol`, {
      metodo: 'PATCH', token: tokenAdministrador, cuerpo: { rol: 'administrador' },
    });
    if (promocion.estado === 200) usuarioPromovido = true;
    comprobar('PATCH promoción a administrador', promocion, 200,
      (datos) => datos?.usuario?.rol === 'administrador');

    comprobar('PATCH intento de cambiar el propio rol', await solicitar(`/api/admin/usuarios/${idAdministrador}/rol`, {
      metodo: 'PATCH', token: tokenAdministrador, cuerpo: { rol: 'cliente' },
    }), 403);

    console.log(`Cuenta de prueba: ${correo}`);
    console.log(`Venta de prueba: ${venta.venta.id}`);
  } finally {
    if (usuarioPromovido && tokenAdministrador && usuarioId) {
      comprobar('restaurar rol de la cuenta de prueba', await solicitar(`/api/admin/usuarios/${usuarioId}/rol`, {
        metodo: 'PATCH', token: tokenAdministrador, cuerpo: { rol: 'cliente' },
      }), 200, (datos) => datos?.usuario?.rol === 'cliente');
    }
  }

  console.log('Prueba de humo completada. La cuenta y la venta permanecen en la base de desarrollo.');
}

if (require.main === module) {
  principal().catch((error) => {
    console.error(`Prueba de humo fallida: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { principal };

process.env.NODE_ENV = 'test';
process.env.JWT_SECRETO = 'secreto-de-pruebas-integracion-1234567890';
process.env.DB_HOST = process.env.DB_HOST || '127.0.0.1';
process.env.DB_PUERTO = process.env.DB_PUERTO || '3306';
process.env.DB_USUARIO = process.env.DB_USUARIO || 'root';
process.env.DB_CONTRASENA = process.env.DB_CONTRASENA || '';
const NOMBRE_BASE = process.env.TEST_DB_NOMBRE || 'proyectorenefull_test';
process.env.DB_NOMBRE = NOMBRE_BASE;
process.env.DEMO_EMAIL = 'cliente.demo@example.com';
process.env.DEMO_NOMBRE = 'Cliente de Demostracion';
process.env.DEMO_CONTRASENA = 'DemoCliente123!';
process.env.ADMIN_EMAIL = 'admin.demo@example.com';
process.env.ADMIN_CONTRASENA = 'AdminDemo123!';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
const mysql = require('mysql2/promise');

const { configuracion } = require('../../src/config/entorno');
const { aplicarMigraciones, validarNombreBase } = require('../../src/db/migraciones');
const { cerrarPool, obtenerPool } = require('../../src/db/conexion');
const usuarioModelo = require('../../src/modelos/usuarioModelo');
const productoModelo = require('../../src/modelos/productoModelo');
const ventaModelo = require('../../src/modelos/ventaModelo');
const { hashear, verificar } = require('../../src/servicios/password');
const { cargarDemo } = require('../../src/servicios/cargaDemo');
const { filtrarVentasValidas } = require('../../src/servicios/registros');
const { estadisticasCliente } = require('../../src/servicios/estadisticas');
const { predecirTodasLasCategorias } = require('../../src/servicios/prediccion');
const { traducirErrorBd } = require('../../src/middleware/errores');
const app = require('../../src/app');

const DIRECTORIO_DEMO = path.join(__dirname, '..', '..', 'data', 'demo');
const CONTRASENA = 'DemoCliente123!';

let conexionAdmin;
let servidor;
let baseUrl;
let demo;
let admin;
let otro;

function conexionSinBase() {
  return mysql.createConnection({
    host: configuracion.db.host,
    port: configuracion.db.puerto,
    user: configuracion.db.usuario,
    password: configuracion.db.contrasena,
    multipleStatements: true,
  });
}

async function contar(tabla) {
  const [filas] = await obtenerPool().query(`SELECT COUNT(*) AS total FROM ${tabla}`);
  return Number(filas[0].total);
}

async function iniciarSesion(correo, contrasena = CONTRASENA) {
  const respuesta = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: correo, password: contrasena }),
  });
  assert.equal(respuesta.status, 200);
  const cuerpo = await respuesta.json();
  assert.equal(typeof cuerpo.token, 'string');
  return cuerpo.token;
}

async function peticion(ruta, token, opciones = {}) {
  const respuesta = await fetch(`${baseUrl}${ruta}`, {
    ...opciones,
    headers: {
      authorization: `Bearer ${token}`,
      ...(opciones.body ? { 'content-type': 'application/json' } : {}),
      ...opciones.headers,
    },
  });
  return { respuesta, cuerpo: await respuesta.json() };
}

before(async () => {
  validarNombreBase(NOMBRE_BASE);
  conexionAdmin = await conexionSinBase();
  await conexionAdmin.query(`DROP DATABASE IF EXISTS \`${NOMBRE_BASE}\``);
  await conexionAdmin.end();
  conexionAdmin = null;

  await aplicarMigraciones({ crearBase: true });

  const hash = await hashear(CONTRASENA);
  demo = await usuarioModelo.crear({
    nombre: 'Cliente de Demostracion',
    correo: configuracion.demo.email,
    contrasenaHash: hash,
    rol: 'cliente',
  });
  admin = await usuarioModelo.crear({
    nombre: 'Administrador de Demostracion',
    correo: configuracion.admin.email,
    contrasenaHash: hash,
    rol: 'administrador',
  });
  otro = await usuarioModelo.crear({
    nombre: 'Otro Cliente',
    correo: 'otro.cliente@example.com',
    contrasenaHash: hash,
    rol: 'cliente',
  });

  servidor = app.listen(0);
  await new Promise((resolver) => servidor.once('listening', resolver));
  baseUrl = `http://127.0.0.1:${servidor.address().port}`;
});

after(async () => {
  if (servidor) {
    await new Promise((resolver) => servidor.close(resolver));
  }
  await cerrarPool();
  if (conexionAdmin) {
    await conexionAdmin.end();
    conexionAdmin = null;
  }
  conexionAdmin = await conexionSinBase();
  await conexionAdmin.query(`DROP DATABASE IF EXISTS \`${NOMBRE_BASE}\``);
  await conexionAdmin.end();
});

test('la migración crea el esquema MySQL del contrato sin convertir IDs a números', async () => {
  const [tablas] = await obtenerPool().query(
    `SELECT TABLE_NAME
       FROM information_schema.tables
      WHERE table_schema = ?
      ORDER BY TABLE_NAME`,
    [NOMBRE_BASE]
  );
  assert.deepEqual(
    tablas.map((fila) => fila.TABLE_NAME),
    ['categorias', 'importaciones', 'migraciones', 'productos', 'usuarios', 'ventas']
  );

  const [columnas] = await obtenerPool().query(
    `SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE
       FROM information_schema.columns
      WHERE table_schema = ?
        AND ((TABLE_NAME = 'usuarios' AND COLUMN_NAME = 'id')
          OR (TABLE_NAME = 'productos' AND COLUMN_NAME IN ('id', 'precio_actual_mxn'))
          OR (TABLE_NAME = 'importaciones' AND COLUMN_NAME IN ('id', 'propietario_id'))
          OR (TABLE_NAME = 'ventas' AND COLUMN_NAME IN
              ('id', 'id_origen', 'propietario_id', 'precio_unitario_mxn', 'total_mxn')))`,
    [NOMBRE_BASE]
  );
  const tipos = new Map(columnas.map((fila) => [`${fila.TABLE_NAME}.${fila.COLUMN_NAME}`, fila.COLUMN_TYPE]));
  assert.equal(tipos.get('usuarios.id'), 'char(36)');
  assert.equal(tipos.get('productos.id'), 'varchar(20)');
  assert.equal(tipos.get('productos.precio_actual_mxn'), 'decimal(12,2)');
  assert.equal(tipos.get('importaciones.id'), 'bigint unsigned');
  assert.equal(tipos.get('importaciones.propietario_id'), 'char(36)');
  assert.equal(tipos.get('ventas.id'), 'bigint unsigned');
  assert.equal(tipos.get('ventas.id_origen'), 'varchar(64)');
  assert.equal(tipos.get('ventas.propietario_id'), 'char(36)');
  assert.equal(tipos.get('ventas.precio_unitario_mxn'), 'decimal(12,2)');
  assert.equal(tipos.get('ventas.total_mxn'), 'decimal(14,2)');

  const [fk] = await obtenerPool().query(
    `SELECT COLUMN_NAME
       FROM information_schema.KEY_COLUMN_USAGE
      WHERE table_schema = ?
        AND table_name = 'ventas'
        AND constraint_name = 'fk_ventas_importacion_propietario'
      ORDER BY ORDINAL_POSITION`,
    [NOMBRE_BASE]
  );
  assert.deepEqual(fk.map((fila) => fila.COLUMN_NAME), ['importacion_id', 'propietario_id']);
  assert.equal(await contar('migraciones'), 1);

  const segunda = await aplicarMigraciones({ crearBase: true });
  assert.deepEqual(segunda.aplicadas, []);
  assert.deepEqual(segunda.omitidas, ['001_esquema_inicial.sql']);
});

test('un fallo durante la carga hace rollback completo de catálogo e importaciones', async () => {
  await obtenerPool().query(
    `CREATE TRIGGER trg_fallo_demo
       BEFORE INSERT ON ventas
       FOR EACH ROW
       SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'fallo de prueba de rollback'`
  );
  try {
    await assert.rejects(
      () =>
        cargarDemo({
          directorio: DIRECTORIO_DEMO,
          correoPropietario: configuracion.demo.email,
          correoImportador: configuracion.admin.email,
        }),
      /fallo de prueba de rollback/
    );
  } finally {
    await obtenerPool().query('DROP TRIGGER IF EXISTS trg_fallo_demo');
  }

  assert.equal(await contar('categorias'), 0);
  assert.equal(await contar('productos'), 0);
  assert.equal(await contar('importaciones'), 0);
  assert.equal(await contar('ventas'), 0);
});

test('carga los cinco conjuntos de forma transaccional con el catálogo y totales esperados', async () => {
  const resumen = await cargarDemo({
    directorio: DIRECTORIO_DEMO,
    correoPropietario: configuracion.demo.email,
    correoImportador: configuracion.admin.email,
  });

  assert.equal(resumen.importados.length, 5);
  assert.equal(resumen.omitidos.length, 0);
  assert.equal(resumen.ventas_insertadas, 500);
  assert.equal(resumen.catalogo.categorias, 6);
  assert.equal(resumen.catalogo.productos, 41);
  assert.deepEqual(resumen.propietario, { id: demo.id, correo: configuracion.demo.email });
  assert.deepEqual(resumen.importador, { id: admin.id, correo: configuracion.admin.email });

  const [totales] = await obtenerPool().query(
    `SELECT COUNT(*) AS ventas,
            SUM(cantidad) AS unidades,
            SUM(total_mxn) AS importe,
            COUNT(DISTINCT producto_id) AS productos,
            COUNT(DISTINCT importacion_id) AS importaciones
       FROM ventas
      WHERE propietario_id = ?`,
    [demo.id]
  );
  assert.equal(Number(totales[0].ventas), 500);
  assert.equal(Number(totales[0].unidades), 1287);
  assert.equal(Number(totales[0].importe), 36404);
  assert.equal(Number(totales[0].productos), 41);
  assert.equal(Number(totales[0].importaciones), 5);

  const [producto] = await obtenerPool().query(
    'SELECT producto_id FROM ventas WHERE propietario_id = ? LIMIT 1',
    [demo.id]
  );
  assert.equal(typeof producto[0].producto_id, 'string');
  assert.match(producto[0].producto_id, /^[A-Z]{1,3}[0-9]{3}$/);

  const [marcadas] = await obtenerPool().query(
    `SELECT COUNT(*) AS total
       FROM ventas v
       INNER JOIN importaciones i ON i.id = v.importacion_id
      WHERE v.propietario_id = ?
        AND i.es_demostracion = 1
        AND v.id_origen IS NOT NULL`,
    [demo.id]
  );
  assert.equal(Number(marcadas[0].total), 500);

  const [precios] = await obtenerPool().query(
    `SELECT COUNT(*) AS total
       FROM ventas v
       INNER JOIN productos p ON p.id = v.producto_id
      WHERE v.propietario_id = ?
        AND v.precio_unitario_mxn <> p.precio_actual_mxn`,
    [demo.id]
  );
  assert.equal(Number(precios[0].total), 0);

  const [importador] = await obtenerPool().query(
    'SELECT DISTINCT importado_por FROM importaciones WHERE propietario_id = ?',
    [demo.id]
  );
  assert.deepEqual(importador.map((fila) => fila.importado_por), [admin.id]);
});

test('una segunda carga del mismo contenido se omite sin duplicar ventas', async () => {
  const resumen = await cargarDemo({
    directorio: DIRECTORIO_DEMO,
    correoPropietario: configuracion.demo.email,
    correoImportador: configuracion.admin.email,
  });

  assert.equal(resumen.importados.length, 0);
  assert.equal(resumen.omitidos.length, 5);
  assert.equal(resumen.ventas_insertadas, 0);
  assert.equal(resumen.ventas_omitidas, 500);
  assert.equal(await contar('importaciones'), 5);
  assert.equal(await contar('ventas'), 500);
});

test('las estadísticas y el modelo de demanda se calculan solo con MySQL', async () => {
  const filas = await ventaModelo.listarPorPropietario(demo.id);
  const { validas, invalidas } = filtrarVentasValidas(filas);
  assert.equal(validas.length, 500);
  assert.equal(invalidas.length, 0);

  const estadisticas = estadisticasCliente(validas, { agrupacion: 'semana' });
  assert.deepEqual(estadisticas.resumen, {
    transacciones_validas: 500,
    unidades: 1287,
    importe_mxn: 36404,
    registros_excluidos: 0,
  });
  assert.equal(estadisticas.por_categoria.length, 6);
  assert.equal(
    new Set(estadisticas.por_semana.map((periodo) => periodo.periodo_inicio)).size,
    27
  );

  const predicciones = predecirTodasLasCategorias(validas, { hoy: '2026-07-01' });
  assert.equal(predicciones.length, 6);
  const conteo = { prediccion: 0, modelo_no_supera_linea_base: 0, sin_historial_suficiente: 0 };
  for (const resultado of predicciones) {
    assert.ok(Object.hasOwn(conteo, resultado.tipo_resultado));
    conteo[resultado.tipo_resultado] += 1;
    assert.equal(resultado.objetivo, 'unidades_vendidas_por_categoria_semana');
    assert.equal(resultado.unidad, 'unidades');
    assert.equal(resultado.es_estimacion, true);
    if (resultado.tipo_resultado === 'prediccion') {
      assert.equal(resultado.modelo.algoritmo, 'Ridge');
      assert.equal(resultado.fuente_datos, 'datos_simulados_de_demostracion');
      assert.equal(typeof resultado.valores.unidades_estimadas, 'number');
      assert.equal(typeof resultado.valores.unidades_redondeadas, 'number');
    } else {
      assert.equal(resultado.valores, undefined);
    }
  }
  assert.equal(conteo.prediccion, 4);
  assert.equal(conteo.modelo_no_supera_linea_base, 2);
  assert.equal(conteo.sin_historial_suficiente, 0);
});

test('la API lee las ventas, estadísticas y predicciones desde MySQL', async () => {
  const token = await iniciarSesion(configuracion.demo.email);

  const listado = await peticion('/api/ventas/mias?limite=5', token);
  assert.equal(listado.respuesta.status, 200);
  assert.equal(listado.cuerpo.items.length, 5);
  assert.equal(listado.cuerpo.total, 500);
  assert.equal(listado.cuerpo.registros_excluidos, 0);
  assert.equal(typeof listado.cuerpo.items[0].producto_id, 'string');

  const estadisticas = await peticion('/api/ventas/mias/estadisticas', token);
  assert.equal(estadisticas.respuesta.status, 200);
  assert.deepEqual(estadisticas.cuerpo.resumen, {
    transacciones_validas: 500,
    unidades: 1287,
    importe_mxn: 36404,
    registros_excluidos: 0,
  });

  const predicciones = await peticion('/api/ventas/mias/predicciones', token);
  assert.equal(predicciones.respuesta.status, 200);
  assert.equal(predicciones.cuerpo.predicciones.length, 6);
  assert.ok(
    predicciones.cuerpo.predicciones.every((resultado) =>
      ['prediccion', 'modelo_no_supera_linea_base', 'sin_historial_suficiente'].includes(
        resultado.tipo_resultado
      )
    )
  );
});

test('la captura manual es idempotente y queda aislada por propietario', async () => {
  const tokenDemo = await iniciarSesion(configuracion.demo.email);
  const tokenOtro = await iniciarSesion('otro.cliente@example.com');
  const producto = await productoModelo.buscarPorId('B003');
  assert.ok(producto);

  const clave = crypto.randomUUID();
  const cuerpo = {
    fecha: '2026-07-01',
    producto_id: producto.producto_id,
    precio_unitario_mxn: Number(producto.precio_actual_mxn),
    cantidad: 2,
    total_mxn: Number(producto.precio_actual_mxn) * 2,
    clave_idempotencia: clave,
  };

  const primera = await peticion('/api/ventas', tokenDemo, {
    method: 'POST',
    body: JSON.stringify(cuerpo),
  });
  assert.equal(primera.respuesta.status, 201);
  const segunda = await peticion('/api/ventas', tokenDemo, {
    method: 'POST',
    body: JSON.stringify(cuerpo),
  });
  assert.equal(segunda.respuesta.status, 200);
  assert.equal(segunda.cuerpo.venta.id, primera.cuerpo.venta.id);

  const [filasClave] = await obtenerPool().query(
    `SELECT COUNT(*) AS total
       FROM ventas
      WHERE propietario_id = ?
        AND clave_idempotencia = ?`,
    [demo.id, clave]
  );
  assert.equal(Number(filasClave[0].total), 1);
  assert.equal(await ventaModelo.contarPorPropietario(demo.id), 501);
  assert.equal(await ventaModelo.contarPorPropietario(otro.id), 0);

  const listadoOtro = await peticion('/api/ventas/mias?limite=5', tokenOtro);
  assert.equal(listadoOtro.respuesta.status, 200);
  assert.equal(listadoOtro.cuerpo.total, 0);
  assert.deepEqual(listadoOtro.cuerpo.items, []);

  const [importacion] = await obtenerPool().query(
    'SELECT id FROM importaciones WHERE propietario_id = ? LIMIT 1',
    [demo.id]
  );
  await assert.rejects(
    () =>
      ventaModelo.insertar({
        propietarioId: otro.id,
        importacionId: importacion[0].id,
        idOrigen: 'D01-999',
        fecha: '2026-07-01',
        productoId: producto.producto_id,
        precioUnitarioMxn: Number(producto.precio_actual_mxn),
        cantidad: 1,
        totalMxn: Number(producto.precio_actual_mxn),
      }),
    (error) => error && error.code === 'ER_NO_REFERENCED_ROW_2'
  );
});

test('la API administrativa exige rol administrador y lee el agregado global', async () => {
  const tokenAdmin = await iniciarSesion(configuracion.admin.email);
  const tokenDemo = await iniciarSesion(configuracion.demo.email);

  const prohibido = await peticion('/api/admin/estadisticas/ventas', tokenDemo);
  assert.equal(prohibido.respuesta.status, 403);

  const estadisticas = await peticion('/api/admin/estadisticas/ventas', tokenAdmin);
  assert.equal(estadisticas.respuesta.status, 200);
  assert.equal(estadisticas.cuerpo.resumen.transacciones_validas, 501);
  assert.equal(estadisticas.cuerpo.resumen.total_clientes, 2);
  assert.equal(estadisticas.cuerpo.clientes.length, 2);
});

test('la contraseña almacenada es un hash Argon2id verificable', async () => {
  const usuario = await usuarioModelo.buscarPorCorreo(configuracion.demo.email);
  assert.match(usuario.password_hash, /^\$argon2id\$/);
  assert.notEqual(usuario.password_hash, CONTRASENA);
  assert.equal(await verificar(usuario.password_hash, CONTRASENA), true);
});

test('el DDL aplica CHECK, UNIQUE y la FK compuesta y traduce los errores', async () => {
  const hashFalso = '$argon2id$v=19$m=65536,t=3,p=4$falso$falso';

  // CHECK: el rol solo admite cliente o administrador.
  await assert.rejects(
    () =>
      obtenerPool().execute(
        `INSERT INTO usuarios (id, nombre, correo, password_hash, rol)
         VALUES (?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), 'Rol inválido', 'rol.invalido@example.com', hashFalso, 'superadmin']
      ),
    (error) => {
      assert.equal(error.code, 'ER_CHECK_CONSTRAINT_VIOLATED');
      const traducido = traducirErrorBd(error);
      assert.equal(traducido.estado, 422);
      assert.equal(traducido.codigo, 'VALIDACION_DATOS');
      return true;
    }
  );

  // UNIQUE: el correo no se puede repetir.
  await assert.rejects(
    () =>
      obtenerPool().execute(
        `INSERT INTO usuarios (id, nombre, correo, password_hash, rol)
         VALUES (?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), 'Correo duplicado', configuracion.demo.email, hashFalso, 'cliente']
      ),
    (error) => error.code === 'ER_DUP_ENTRY'
  );

  // CHECK: importacion_id e id_origen deben ir juntos.
  const [producto] = await obtenerPool().query(
    'SELECT id, precio_actual_mxn FROM productos LIMIT 1'
  );
  await assert.rejects(
    () =>
      ventaModelo.insertar({
        propietarioId: demo.id,
        importacionId: null,
        idOrigen: 'D01-777',
        fecha: '2026-07-01',
        productoId: producto[0].id,
        precioUnitarioMxn: Number(producto[0].precio_actual_mxn),
        cantidad: 1,
        totalMxn: Number(producto[0].precio_actual_mxn),
      }),
    (error) => error.code === 'ER_CHECK_CONSTRAINT_VIOLATED'
  );

  // FK compuesta: una venta no puede apuntar a la importación de otro propietario.
  const [importacion] = await obtenerPool().query(
    'SELECT id FROM importaciones WHERE propietario_id = ? LIMIT 1',
    [demo.id]
  );
  await assert.rejects(
    () =>
      ventaModelo.insertar({
        propietarioId: otro.id,
        importacionId: importacion[0].id,
        idOrigen: 'D01-778',
        fecha: '2026-07-01',
        productoId: producto[0].id,
        precioUnitarioMxn: Number(producto[0].precio_actual_mxn),
        cantidad: 1,
        totalMxn: Number(producto[0].precio_actual_mxn),
      }),
    (error) => error.code === 'ER_NO_REFERENCED_ROW_2'
  );
});

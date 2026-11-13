const { randomBytes } = require('node:crypto');

process.env.NODE_ENV = 'test';
process.env.DB_HOST = process.env.DB_HOST || '127.0.0.1';
process.env.DB_PUERTO = process.env.DB_PUERTO || '3306';
process.env.DB_USUARIO = process.env.DB_USUARIO || 'root';
process.env.DB_CONTRASENA = process.env.DB_CONTRASENA || '';
const PREFIJO_BASE = process.env.TEST_DB_NOMBRE || 'proyectorenefull_test';
if (!/^[A-Za-z0-9_]{1,40}$/.test(PREFIJO_BASE)) {
  throw new Error('TEST_DB_NOMBRE debe ser un prefijo de 1 a 40 letras, números o guiones bajos.');
}
const NOMBRE_BASE = `${PREFIJO_BASE}_${process.pid}_${randomBytes(4).toString('hex')}`;
process.env.TEST_DB_NOMBRE = NOMBRE_BASE;
process.env.DB_NOMBRE = NOMBRE_BASE;
process.env.DEMO_EMAIL = 'cliente.demo@example.com';
process.env.DEMO_NOMBRE = 'Cliente de Demostracion';

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const mysql = require('mysql2/promise');

const { configuracion } = require('../../src/config/entornoDatos');
const { aplicarMigraciones } = require('../../src/db/migraciones');
const { cerrarPool, obtenerPool } = require('../../src/db/mysql');
const { crearClienteDemo } = require('../../src/datos/cuentas');
const { cargarDemo } = require('../../src/datos/importador');
const {
  cargarVentasParaModelo,
  estadisticasAdmin,
  estadisticasCliente,
  listarVentasValidas,
  obtenerVentaValida,
} = require('../../src/datos/consultas');
const { predecirDemanda } = require('../../src/ml/demanda');

const DEMO_EMAIL = 'cliente.demo@example.com';
const HOY = '2026-11-12';
let idDemo;

async function reiniciarBase() {
  const conexion = await mysql.createConnection({
    host: configuracion.db.host,
    port: configuracion.db.puerto,
    user: configuracion.db.usuario,
    password: configuracion.db.contrasena,
  });
  try {
    await conexion.query(`DROP DATABASE IF EXISTS \`${NOMBRE_BASE}\``);
  } finally {
    await conexion.end();
  }
}

async function limpiarTablas() {
  const conexion = await obtenerPool().getConnection();
  try {
    await conexion.query('SET FOREIGN_KEY_CHECKS = 0');
    await conexion.query('TRUNCATE TABLE ventas');
    await conexion.query('TRUNCATE TABLE importaciones');
    await conexion.query('TRUNCATE TABLE productos');
    await conexion.query('TRUNCATE TABLE usuarios');
    await conexion.query('SET FOREIGN_KEY_CHECKS = 1');
  } finally {
    conexion.release();
  }
}

before(async () => {
  await reiniciarBase();
  await aplicarMigraciones({ nombreBase: NOMBRE_BASE, crearBase: true });
});

beforeEach(async () => {
  await limpiarTablas();
  const cuenta = await crearClienteDemo({
    email: DEMO_EMAIL,
    nombre: 'Cliente de Demostracion',
    password: 'Demo12345',
  });
  idDemo = cuenta.usuario.id;
});

after(async () => {
  await cerrarPool();
  const conexion = await mysql.createConnection({
    host: configuracion.db.host,
    port: configuracion.db.puerto,
    user: configuracion.db.usuario,
    password: configuracion.db.contrasena,
  });
  try {
    await conexion.query(`DROP DATABASE IF EXISTS \`${NOMBRE_BASE}\``);
  } finally {
    await conexion.end();
  }
});

test('la migración crea tablas, índices y columnas con IDs de texto', async () => {
  const pool = obtenerPool();
  const [tablas] = await pool.query('SHOW TABLES');
  const nombres = tablas.map((fila) => Object.values(fila)[0]).sort();
  assert.deepEqual(nombres, [
    'importaciones',
    'migraciones',
    'productos',
    'usuarios',
    'ventas',
  ]);

  const [columnas] = await pool.query(
    `SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME IN ('usuarios', 'productos', 'ventas')`,
    [NOMBRE_BASE]
  );
  const porTabla = new Map();
  for (const columna of columnas) {
    porTabla.set(`${columna.TABLE_NAME}.${columna.COLUMN_NAME}`, columna.COLUMN_TYPE);
  }
  assert.equal(porTabla.get('ventas.id_venta'), 'bigint unsigned');
  assert.equal(porTabla.get('ventas.id_origen'), 'varchar(32)');
  assert.equal(porTabla.get('ventas.producto_id'), 'varchar(20)');
  assert.equal(porTabla.get('productos.producto_id'), 'varchar(20)');
  assert.equal(porTabla.get('usuarios.password_hash'), 'varchar(255)');

  const [indices] = await pool.query('SHOW INDEX FROM ventas');
  const nombresIndices = new Set(indices.map((indice) => indice.Key_name));
  assert.ok(nombresIndices.has('uq_ventas_importacion_origen'));
  assert.ok(nombresIndices.has('ix_ventas_usuario_fecha'));

  const [foraneas] = await pool.query(
    `SELECT DISTINCT CONSTRAINT_NAME
       FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = 'ventas'
        AND REFERENCED_TABLE_NAME IS NOT NULL`,
    [NOMBRE_BASE]
  );
  assert.equal(foraneas.length, 3);
});

test('el migrador omite lo aplicado y detecta cambios de contenido', async () => {
  const segunda = await aplicarMigraciones({ nombreBase: NOMBRE_BASE, crearBase: false });
  assert.deepEqual(segunda.aplicadas, []);
  assert.ok(segunda.omitidas.includes('001_esquema_inicial.sql'));

  const directorio = fs.mkdtempSync(path.join(os.tmpdir(), 'renefull-migracion-cambiada-'));
  try {
    fs.writeFileSync(
      path.join(directorio, '001_esquema_inicial.sql'),
      '-- contenido distinto para probar el guardia de hash\n'
    );
    await assert.rejects(
      aplicarMigraciones({
        nombreBase: NOMBRE_BASE,
        crearBase: false,
        directorio,
      }),
      /otro contenido/
    );
  } finally {
    fs.rmSync(directorio, { recursive: true, force: true });
  }
});

test('MySQL rechaza hashes, orígenes y totales inválidos', async () => {
  const pool = obtenerPool();
  await assert.rejects(
    pool.execute(
      "INSERT INTO usuarios (nombre, email, password_hash) VALUES ('X', 'x@example.com', 'texto')"
    ),
    /Check constraint/
  );

  await pool.execute(
    `INSERT INTO productos (producto_id, producto, categoria, precio_unitario_mxn)
     VALUES ('B003', 'Jugo de naranja 1 L', 'Bebidas', 31)`
  );

  await assert.rejects(
    pool.execute(
      `INSERT INTO ventas
         (usuario_id, fecha, producto_id, producto, categoria, precio_unitario_mxn, cantidad, total_mxn)
       VALUES (?, '2026-01-01', 'B003', 'Jugo de naranja 1 L', 'Bebidas', 31, 2, 100)`,
      [idDemo]
    ),
    /Check constraint/
  );

  await assert.rejects(
    pool.execute(
      `INSERT INTO ventas
         (id_origen, usuario_id, fecha, producto_id, producto, categoria, precio_unitario_mxn, cantidad, total_mxn)
       VALUES ('D01-001', ?, '2026-01-01', 'B003', 'Jugo de naranja 1 L', 'Bebidas', 31, 2, 62)`,
      [idDemo]
    ),
    /Check constraint/
  );
});

test('carga los cinco conjuntos, conserva precios históricos y es idempotente', async () => {
  const pool = obtenerPool();
  const primero = await cargarDemo({ emailDemo: DEMO_EMAIL, hoy: HOY });
  assert.equal(primero.totales.archivos, 5);
  assert.equal(primero.totales.ventas_insertadas, 500);
  assert.equal(primero.totales.ventas_existentes, 0);

  const [[conteo]] = await pool.query(
    'SELECT COUNT(*) AS ventas, SUM(cantidad) AS unidades, SUM(total_mxn) AS importe FROM ventas'
  );
  assert.equal(Number(conteo.ventas), 500);
  assert.equal(Number(conteo.unidades), 1287);
  assert.equal(Number(conteo.importe), 36404);

  const [fila] = await pool.execute(
    `SELECT id_venta, id_origen, producto_id, precio_unitario_mxn, total_mxn
       FROM ventas WHERE id_origen = 'D01-066'`
  );
  assert.equal(fila.length, 1);
  assert.equal(fila[0].id_origen, 'D01-066');
  assert.equal(fila[0].producto_id, 'B003');
  assert.equal(Number(fila[0].precio_unitario_mxn), 31);
  assert.equal(Number(fila[0].total_mxn), 124);
  assert.notEqual(String(fila[0].id_venta), fila[0].id_origen);

  await pool.execute(
    "UPDATE productos SET precio_unitario_mxn = 999.99 WHERE producto_id = 'B003'"
  );
  const [historica] = await pool.execute(
    "SELECT precio_unitario_mxn FROM ventas WHERE id_origen = 'D01-066'"
  );
  assert.equal(Number(historica[0].precio_unitario_mxn), 31);

  const segundo = await cargarDemo({ emailDemo: DEMO_EMAIL, hoy: HOY });
  assert.equal(segundo.totales.ventas_insertadas, 0);
  assert.equal(segundo.totales.archivos_ya_importados, 5);
  const [[conteoFinal]] = await pool.query('SELECT COUNT(*) AS ventas FROM ventas');
  assert.equal(Number(conteoFinal.ventas), 500);
});

test('si un hash cambia, la carga falla sin duplicar ni borrar datos', async () => {
  const pool = obtenerPool();
  await cargarDemo({ emailDemo: DEMO_EMAIL, hoy: HOY });
  await pool.execute(
    `UPDATE importaciones
        SET hash_sha256 = REPEAT('0', 64)
      WHERE conjunto = 'sucursal_demo_01'`
  );
  await assert.rejects(
    cargarDemo({ emailDemo: DEMO_EMAIL, hoy: HOY }),
    (error) => error.codigo === 'CONFLICTO_IMPORTACION'
  );
  const [[conteo]] = await pool.query('SELECT COUNT(*) AS ventas FROM ventas');
  assert.equal(Number(conteo.ventas), 500);
});

test('una fila inválida revierte toda la carga antes de insertar', async () => {
  const pool = obtenerPool();
  const directorio = fs.mkdtempSync(path.join(os.tmpdir(), 'renefull-demo-invalida-'));
  const archivo = path.join(directorio, 'ventas_sucursal_demo_99.json');
  fs.writeFileSync(
    archivo,
    JSON.stringify({
      metadata: {
        conjunto: 'sucursal_demo_99',
        perfil_demanda: 'prueba',
        datos_simulados: true,
        moneda: 'MXN',
        periodo_inicio: '2026-01-01',
        periodo_fin: '2026-06-30',
        cantidad_registros: 1,
      },
      ventas: [
        {
          id_venta: 'D99-001',
          fecha: '2026-01-02',
          producto_id: 'B003',
          producto: 'Jugo de naranja 1 L',
          categoria: 'Bebidas',
          precio_unitario_mxn: 31,
          cantidad: 2,
          total_mxn: 100,
        },
      ],
    })
  );

  try {
    await assert.rejects(
      cargarDemo({
        directorio,
        emailDemo: DEMO_EMAIL,
        hoy: HOY,
        exigirCinco: false,
        exigirCien: false,
      }),
      (error) => error.codigo === 'VALIDACION_DATOS'
    );
    const [[conteo]] = await pool.query(
      'SELECT (SELECT COUNT(*) FROM ventas) AS ventas, (SELECT COUNT(*) FROM importaciones) AS importaciones'
    );
    assert.equal(Number(conteo.ventas), 0);
    assert.equal(Number(conteo.importaciones), 0);
  } finally {
    fs.rmSync(directorio, { recursive: true, force: true });
  }
});

test('un fallo de MySQL durante la inserción revierte catálogo, importaciones y ventas', async () => {
  const pool = obtenerPool();
  await pool.query(
    `CREATE TRIGGER trg_fallo_ventas BEFORE INSERT ON ventas
     FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'fallo simulado'`
  );
  try {
    await assert.rejects(cargarDemo({ emailDemo: DEMO_EMAIL, hoy: HOY }), /fallo simulado/);
    const [[conteo]] = await pool.query(
      `SELECT (SELECT COUNT(*) FROM ventas) AS ventas,
              (SELECT COUNT(*) FROM importaciones) AS importaciones,
              (SELECT COUNT(*) FROM productos) AS productos`
    );
    assert.equal(Number(conteo.ventas), 0);
    assert.equal(Number(conteo.importaciones), 0);
    assert.equal(Number(conteo.productos), 0);
  } finally {
    await pool.query('DROP TRIGGER IF EXISTS trg_fallo_ventas');
  }
});

test('las consultas filtran por propietario y excluyen registros inválidos', async () => {
  const pool = obtenerPool();
  await cargarDemo({ emailDemo: DEMO_EMAIL, hoy: HOY });
  const otra = await crearClienteDemo({
    email: 'otra.cliente@example.com',
    nombre: 'Otra Cliente',
    password: 'Demo12345',
  });
  const idOtra = otra.usuario.id;

  await pool.execute(
    `INSERT INTO ventas
       (usuario_id, fecha, producto_id, producto, categoria, precio_unitario_mxn, cantidad, total_mxn)
     VALUES (?, '2026-06-30', 'B003', 'Jugo de naranja 1 L', 'Bebidas', 31, 2, 62)`,
    [idOtra]
  );

  const demo = await listarVentasValidas(idDemo);
  const ajeno = await listarVentasValidas(idOtra);
  assert.equal(demo.ventas.length, 500);
  assert.equal(ajeno.ventas.length, 1);
  assert.equal(ajeno.ventas[0].usuario_id, idOtra);

  const statsOtra = await estadisticasCliente(idOtra);
  assert.equal(statsOtra.total_ventas, 1);
  assert.equal(statsOtra.total_unidades, 2);
  assert.equal(statsOtra.total_importe_mxn, 62);

  const statsAdmin = await estadisticasAdmin({ agrupacion: 'mes' });
  assert.equal(statsAdmin.totales.ventas, 501);
  assert.ok(statsAdmin.grupos.length > 0);

  const [resultadoInvalido] = await pool.execute(
    `INSERT INTO ventas
       (usuario_id, fecha, producto_id, producto, categoria, precio_unitario_mxn, cantidad, total_mxn)
     VALUES (?, '2026-06-30', 'B003', 'Producto alterado', 'Bebidas', 31, 1, 31)`,
    [idDemo]
  );
  const idInvalido = resultadoInvalido.insertId;

  const conInvalidas = await listarVentasValidas(idDemo);
  assert.equal(conInvalidas.ventas.length, 500);
  assert.equal(conInvalidas.excluidas.length, 1);
  await assert.rejects(
    obtenerVentaValida(idDemo, idInvalido),
    (error) => error.codigo === 'REGISTRO_INVALIDO'
  );

  const paraModelo = await cargarVentasParaModelo({ usuarioId: idDemo });
  assert.equal(paraModelo.ventas.length, 500);
  assert.equal(paraModelo.excluidas.length, 1);
  assert.ok(paraModelo.ventas.every((venta) => venta.es_demostracion === true));
});

test('el modelo usa ventas válidas del propietario y no inventa resultados', async () => {
  const pool = obtenerPool();
  await cargarDemo({ emailDemo: DEMO_EMAIL, hoy: HOY });
  const { ventas } = await cargarVentasParaModelo({ usuarioId: idDemo });
  assert.equal(ventas.length, 500);

  const resultado = predecirDemanda(ventas, { horizonte: 7 });
  assert.equal(resultado.por_categoria.length, 6);
  assert.equal(resultado.datos.fuente, 'datos_simulados_de_demostracion');
  assert.equal(resultado.resumen_categorias.ok, 4);
  assert.equal(resultado.resumen_categorias.modelo_no_supera_linea_base, 2);
  assert.equal(resultado.estado, 'modelo_no_supera_linea_base');
  assert.deepEqual(resultado.valores, []);

  for (const categoria of resultado.por_categoria) {
    assert.ok(
      ['ok', 'sin_base_suficiente', 'modelo_no_supera_linea_base'].includes(categoria.estado)
    );
    if (categoria.estado !== 'ok') {
      assert.deepEqual(categoria.valores, []);
    } else {
      assert.equal(categoria.valores.length, 1);
      assert.ok(categoria.valores[0].cantidad_estimada >= 0);
      assert.ok(categoria.evaluacion.mae_modelo < categoria.evaluacion.mae_linea_base);
    }
  }

  const [[conteo]] = await pool.query('SELECT COUNT(*) AS ventas FROM ventas');
  assert.equal(Number(conteo.ventas), 500);
});

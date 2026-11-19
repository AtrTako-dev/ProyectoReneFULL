const path = require('node:path');
const { spawnSync } = require('node:child_process');
const readline = require('node:readline/promises');
const { stdin, stdout } = require('node:process');
const { configuracion } = require('../src/config/entorno');
const { crearConexion } = require('../src/db/conexion');
const { aplicarMigraciones, validarNombreBase } = require('../src/db/migraciones');
const { emailValido } = require('../src/validaciones/comunes');

const DIRECTORIO_BACKEND = path.join(__dirname, '..');

function esHostLocal(host) {
  return ['localhost', '127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(
    String(host).toLowerCase()
  );
}

function validarEntorno(argumentos) {
  if (!argumentos.includes('--confirmar')) {
    throw new Error('Falta --confirmar. Uso: npm run db:reiniciar -- --confirmar');
  }
  if (configuracion.entorno === 'production') {
    throw new Error('El reinicio está deshabilitado cuando NODE_ENV=production.');
  }
  if (!esHostLocal(configuracion.db.host) && !argumentos.includes('--permitir-remoto')) {
    throw new Error('DB_HOST no es local. Para permitir un servidor remoto, añade --permitir-remoto.');
  }

  const base = validarNombreBase(configuracion.db.nombre);
  const nombreConfigurado = process.env.DB_NOMBRE || 'proyecto_renefull';
  if (base !== nombreConfigurado) {
    throw new Error('La base objetivo no coincide con DB_NOMBRE.');
  }

  const campos = {};
  const correoAdmin = emailValido(configuracion.admin.email, 'ADMIN_EMAIL', campos);
  const correoDemo = emailValido(configuracion.demo.email, 'DEMO_EMAIL', campos);
  if (!correoAdmin || !correoDemo || correoAdmin === correoDemo) {
    throw new Error('Configura ADMIN_EMAIL y DEMO_EMAIL válidos y distintos antes del reinicio.');
  }
  if (
    configuracion.admin.nombre.trim().length < 1 ||
    configuracion.admin.nombre.trim().length > 120 ||
    configuracion.demo.nombre.trim().length < 1 ||
    configuracion.demo.nombre.trim().length > 120
  ) {
    throw new Error('ADMIN_NOMBRE y DEMO_NOMBRE deben tener entre 1 y 120 caracteres.');
  }
  if (configuracion.admin.contrasena.length < 8 || configuracion.demo.contrasena.length < 8) {
    throw new Error('Configura ADMIN_CONTRASENA y DEMO_CONTRASENA con al menos 8 caracteres.');
  }
  if (configuracion.admin.contrasena.length > 128 || configuracion.demo.contrasena.length > 128) {
    throw new Error('Las contraseñas de administrador y demo no pueden superar 128 caracteres.');
  }

  return base;
}

async function confirmarBase(base) {
  const terminal = readline.createInterface({ input: stdin, output: stdout });
  try {
    const respuesta = await terminal.question(
      `Se eliminará la base "${base}" en ${configuracion.db.host}:${configuracion.db.puerto}. ` +
        `Escribe exactamente ${base} para confirmar: `
    );
    return respuesta.trim() === base;
  } finally {
    terminal.close();
  }
}

function ejecutarScript(nombre) {
  const resultado = spawnSync(process.execPath, [path.join(__dirname, nombre)], {
    cwd: DIRECTORIO_BACKEND,
    env: process.env,
    stdio: 'inherit',
  });
  if (resultado.error) throw resultado.error;
  if (resultado.status !== 0) {
    throw new Error(`${nombre} terminó con código ${resultado.status ?? 'desconocido'}.`);
  }
}

async function reiniciar(argumentos = process.argv.slice(2)) {
  const base = validarEntorno(argumentos);
  if (!(await confirmarBase(base))) {
    throw new Error('Confirmación incorrecta; la base no se modificó.');
  }

  const conexion = await crearConexion();
  try {
    await conexion.query(`DROP DATABASE IF EXISTS \`${base}\``);
  } finally {
    await conexion.end();
  }

  const migracion = await aplicarMigraciones({ crearBase: true, nombreBase: base });
  process.stdout.write(`Esquema creado: ${base}. Migraciones aplicadas: ${migracion.aplicadas.join(', ') || 'ninguna'}.\n`);
  ejecutarScript('crearAdmin.js');
  ejecutarScript('crearClienteDemo.js');
  process.stdout.write('Base reiniciada con administrador y cliente demo listos.\n');
}

if (require.main === module) {
  reiniciar().catch((error) => {
    console.error(`No fue posible reiniciar la base: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { esHostLocal, reiniciar, validarEntorno };

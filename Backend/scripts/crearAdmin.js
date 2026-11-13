const { configuracion } = require('../src/config/entorno');
const { hashear } = require('../src/servicios/password');
const usuarioModelo = require('../src/modelos/usuarioModelo');
const { cerrarPool } = require('../src/db/conexion');

async function principal() {
  const correo = (configuracion.admin.email || '').trim().toLowerCase();
  const contrasena = configuracion.admin.contrasena || '';
  const nombre = (configuracion.admin.nombre || 'Administrador').trim();

  if (!correo || !contrasena) {
    throw new Error(
      'Configura ADMIN_EMAIL y ADMIN_CONTRASENA en el archivo .env antes de ejecutar este comando.'
    );
  }
  if (contrasena.length < 8) {
    throw new Error('La contraseña administradora debe tener al menos 8 caracteres.');
  }
  if (nombre.length < 1 || nombre.length > 120) {
    throw new Error('ADMIN_NOMBRE debe tener entre 1 y 120 caracteres.');
  }

  const existente = await usuarioModelo.buscarPorCorreo(correo);
  if (existente) {
    throw new Error('Ya existe una cuenta con ese correo; no se creó otra.');
  }

  const contrasenaHash = await hashear(contrasena);
  const usuario = await usuarioModelo.crear({
    nombre,
    correo,
    contrasenaHash,
    rol: 'administrador',
  });

  console.log(`Cuenta administradora creada: ${usuario.correo} (id ${usuario.id}).`);
}

if (require.main === module) {
  principal()
    .catch((error) => {
      console.error(`No se pudo crear la cuenta administradora: ${error.message}`);
      process.exitCode = 1;
    })
    .finally(cerrarPool);
}

module.exports = { principal };

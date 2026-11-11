const { configuracion } = require('../src/config/entorno');
const { hashear } = require('../src/servicios/password');
const usuarioModelo = require('../src/modelos/usuarioModelo');
const { cerrarPool } = require('../src/db/conexion');

async function principal() {
  const email = (configuracion.admin.email || '').trim().toLowerCase();
  const contrasena = configuracion.admin.contrasena || '';

  if (!email || !contrasena) {
    throw new Error('Configura ADMIN_EMAIL y ADMIN_CONTRASENA en el archivo .env antes de ejecutar este comando.');
  }
  if (contrasena.length < 8) {
    throw new Error('La contraseña administradora debe tener al menos 8 caracteres.');
  }

  const existente = await usuarioModelo.buscarPorEmail(email);
  if (existente) {
    throw new Error('Ya existe una cuenta con ese correo; no se creó otra.');
  }

  const contrasenaHash = await hashear(contrasena);
  const usuario = await usuarioModelo.crear({
    nombre: 'Administrador',
    email,
    contrasenaHash,
    rol: 'administrador',
  });

  console.log(`Cuenta administradora creada: ${usuario.email} (id ${usuario.id}).`);
}

principal()
  .catch((error) => {
    console.error(`No se pudo crear la cuenta administradora: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(cerrarPool);

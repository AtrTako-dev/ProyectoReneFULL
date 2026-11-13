const { configuracion } = require('../src/config/entorno');
const usuarioModelo = require('../src/modelos/usuarioModelo');
const { hashear } = require('../src/servicios/password');
const { emailValido } = require('../src/validaciones/comunes');
const { cerrarPool } = require('../src/db/conexion');

function estaActivo(usuario) {
  return Boolean(usuario) && (usuario.activo === true || Number(usuario.activo) === 1);
}

async function principal() {
  const correo = (configuracion.demo.email || '').trim().toLowerCase();
  const nombre = (configuracion.demo.nombre || '').trim();
  const contrasena = configuracion.demo.contrasena || '';

  if (!emailValido(correo, 'correo', {})) {
    throw new Error('Configura DEMO_EMAIL con un correo válido.');
  }
  if (nombre.length < 1 || nombre.length > 120) {
    throw new Error('DEMO_NOMBRE debe tener entre 1 y 120 caracteres.');
  }
  if (contrasena.length < 8) {
    throw new Error('Configura DEMO_CONTRASENA con al menos 8 caracteres.');
  }

  const existente = await usuarioModelo.buscarPorCorreo(correo);
  if (existente) {
    if (existente.rol !== 'cliente' || !estaActivo(existente)) {
      throw new Error('La cuenta DEMO_EMAIL existe, pero no es un cliente activo.');
    }
    return {
      estado: 'existente',
      id: existente.id,
      correo: existente.correo,
      rol: existente.rol,
    };
  }

  const usuario = await usuarioModelo.crear({
    nombre,
    correo,
    contrasenaHash: await hashear(contrasena),
    rol: 'cliente',
  });
  return {
    estado: 'creado',
    id: usuario.id,
    correo: usuario.correo,
    rol: usuario.rol,
  };
}

principal()
  .then((resultado) => {
    console.log(JSON.stringify(resultado, null, 2));
  })
  .catch((error) => {
    console.error(`No fue posible preparar la cuenta demo: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(cerrarPool);

const { hash, Algorithm } = require('@node-rs/argon2');
const { conTransaccion } = require('../db/mysql');
const { ErrorOperacionNoPermitida } = require('./errores');
const { emailValido, normalizarEmail } = require('./validacion');

function validarNombre(nombre) {
  const limpio = typeof nombre === 'string' ? nombre.trim() : '';
  if (limpio.length < 1 || limpio.length > 120) {
    throw new ErrorOperacionNoPermitida('El nombre debe tener entre 1 y 120 caracteres.');
  }
  return limpio;
}

function validarPassword(password) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    throw new ErrorOperacionNoPermitida(
      'La contraseña debe tener entre 8 y 128 caracteres; no se guarda en el repositorio.'
    );
  }
  return password;
}

async function crearClienteDemo({ email, password, nombre }) {
  const correo = normalizarEmail(email);
  if (!emailValido(correo)) {
    throw new ErrorOperacionNoPermitida('DEMO_EMAIL no es un correo válido.');
  }
  const nombreLimpio = validarNombre(nombre);
  validarPassword(password);

  const passwordHash = await hash(password, {
    algorithm: Algorithm.Argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  return conTransaccion(async (conexion) => {
    const [filas] = await conexion.execute(
      'SELECT id, nombre, email, rol, activo FROM usuarios WHERE email = ? FOR UPDATE',
      [correo]
    );
    if (filas.length > 0) {
      const existente = filas[0];
      if (existente.rol !== 'cliente') {
        throw new ErrorOperacionNoPermitida(
          `La cuenta ${correo} ya existe pero no es cliente; no se modifica.`
        );
      }
      if (Number(existente.activo) !== 1) {
        throw new ErrorOperacionNoPermitida(`La cuenta ${correo} ya existe pero está inactiva.`);
      }
      return {
        estado: 'ya_existe',
        usuario: {
          id: Number(existente.id),
          nombre: existente.nombre,
          email: existente.email,
          rol: existente.rol,
        },
      };
    }

    const [resultado] = await conexion.execute(
      'INSERT INTO usuarios (nombre, email, password_hash, rol, activo) VALUES (?, ?, ?, ?, 1)',
      [nombreLimpio, correo, passwordHash, 'cliente']
    );
    return {
      estado: 'creado',
      usuario: {
        id: Number(resultado.insertId),
        nombre: nombreLimpio,
        email: correo,
        rol: 'cliente',
      },
    };
  });
}

module.exports = { crearClienteDemo };

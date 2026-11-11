const { ErrorApi, errores } = require('../middleware/errores');
const { hashear, verificar } = require('../servicios/password');
const { firmarToken } = require('../servicios/token');
const { usuarioPublico } = require('../servicios/serializadores');
const usuarioModelo = require('../modelos/usuarioModelo');
const { validarRegistro, validarLogin } = require('../validaciones/auth');

async function registro(req, res, next) {
  try {
    const { campos, datos } = validarRegistro(req.body);
    if (Object.keys(campos).length > 0) {
      return next(errores.validacion(campos));
    }

    const existente = await usuarioModelo.buscarPorEmail(datos.email);
    if (existente) {
      return next(errores.conflicto('El correo ya está registrado.'));
    }

    const contrasenaHash = await hashear(datos.password);
    const usuario = await usuarioModelo.crear({
      nombre: datos.nombre,
      email: datos.email,
      contrasenaHash,
      rol: 'cliente',
    });

    return res.status(201).json({
      token: firmarToken(usuario.id),
      usuario: usuarioPublico(usuario),
    });
  } catch (error) {
    return next(error);
  }
}

async function login(req, res, next) {
  try {
    const { campos, datos } = validarLogin(req.body);
    if (Object.keys(campos).length > 0) {
      return next(errores.validacion(campos));
    }

    const usuario = await usuarioModelo.buscarPorEmail(datos.email);
    const contrasenaCorrecta = usuario
      ? await verificar(usuario.password_hash, datos.password)
      : false;

    if (!usuario || !contrasenaCorrecta) {
      return next(
        new ErrorApi(401, 'NO_AUTENTICADO', 'Correo o contraseña incorrectos.')
      );
    }

    return res.json({
      token: firmarToken(usuario.id),
      usuario: usuarioPublico(usuario),
    });
  } catch (error) {
    return next(error);
  }
}

function me(req, res) {
  return res.json({ usuario: usuarioPublico(req.usuario) });
}

module.exports = { registro, login, me };

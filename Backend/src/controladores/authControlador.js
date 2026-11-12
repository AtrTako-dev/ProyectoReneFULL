const { ErrorApi, errores } = require('../middleware/errores');
const { estaActivo } = require('../middleware/auth');
const { hashear, verificar } = require('../servicios/password');
const { firmarToken } = require('../servicios/token');
const { usuarioPublico } = require('../servicios/serializadores');
const usuarioModelo = require('../modelos/usuarioModelo');
const { validarRegistro, validarLogin } = require('../validaciones/auth');

function respuestaSesion(usuario) {
  return {
    token: firmarToken(usuario.id),
    usuario: usuarioPublico(usuario),
  };
}

async function registro(req, res, next) {
  try {
    const { campos, datos } = validarRegistro(req.body);
    if (Object.keys(campos).length > 0) {
      return next(errores.validacion(campos));
    }

    const existente = await usuarioModelo.buscarPorCorreo(datos.email);
    if (existente) {
      return next(errores.conflicto('El correo ya está registrado.'));
    }

    const contrasenaHash = await hashear(datos.password);
    try {
      const usuario = await usuarioModelo.crear({
        nombre: datos.nombre,
        correo: datos.email,
        contrasenaHash,
        // El registro público siempre crea clientes.
        rol: 'cliente',
      });
      return res.status(201).json(respuestaSesion(usuario));
    } catch (error) {
      if (error && error.code === 'ER_DUP_ENTRY') {
        return next(errores.conflicto('El correo ya está registrado.'));
      }
      throw error;
    }
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

    const usuario = await usuarioModelo.buscarPorCorreo(datos.email);
    const contrasenaCorrecta = usuario
      ? await verificar(usuario.password_hash, datos.password)
      : false;

    // Mismo mensaje para correo inexistente, contraseña incorrecta o cuenta inactiva.
    if (!usuario || !contrasenaCorrecta || !estaActivo(usuario)) {
      return next(
        new ErrorApi(401, 'NO_AUTENTICADO', 'Correo o contraseña incorrectos.')
      );
    }

    return res.json(respuestaSesion(usuario));
  } catch (error) {
    return next(error);
  }
}

function me(req, res) {
  return res.json({ usuario: usuarioPublico(req.usuario) });
}

module.exports = { registro, login, me };

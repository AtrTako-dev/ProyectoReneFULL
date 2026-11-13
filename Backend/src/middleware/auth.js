const { verificarToken } = require('../servicios/token');
const { errores } = require('./errores');
const { esUuid } = require('../validaciones/comunes');
const usuarioModelo = require('../modelos/usuarioModelo');

function estaActivo(usuario) {
  return Boolean(usuario) && (usuario.activo === true || Number(usuario.activo) === 1);
}

function crearRequiereAutenticacion({ verificar = verificarToken } = {}) {
  return function requiereAutenticacion(req, res, next) {
    const encabezado = req.headers.authorization;
    if (!encabezado || !encabezado.startsWith('Bearer ')) {
      return next(errores.noAutenticado());
    }
    const token = encabezado.slice('Bearer '.length).trim();
    if (!token) {
      return next(errores.noAutenticado());
    }
    try {
      const contenido = verificar(token);
      // El token solo porta identidad. El sub debe ser el UUID del usuario.
      if (!contenido || !esUuid(contenido.sub)) {
        return next(errores.noAutenticado());
      }
      req.usuarioId = contenido.sub.toLowerCase();
      return next();
    } catch {
      return next(errores.noAutenticado());
    }
  };
}

function crearCargarUsuarioActual({
  buscarUsuario = (id) => usuarioModelo.buscarPorId(id),
} = {}) {
  return async function cargarUsuarioActual(req, res, next) {
    try {
      const usuario = await buscarUsuario(req.usuarioId);
      if (!estaActivo(usuario)) {
        // Una cuenta inexistente o inactiva equivale a no tener sesión.
        return next(errores.noAutenticado());
      }
      req.usuario = usuario;
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

function crearRequiereRol(
  roles,
  { buscarUsuario = (id) => usuarioModelo.buscarPorId(id) } = {}
) {
  const cargarUsuario = crearCargarUsuarioActual({ buscarUsuario });
  return function requiereRol(req, res, next) {
    cargarUsuario(req, res, (error) => {
      if (error) {
        return next(error);
      }
      if (!roles.includes(req.usuario.rol)) {
        return next(errores.noAutorizado());
      }
      return next();
    });
  };
}

const requiereAutenticacion = crearRequiereAutenticacion();
const cargarUsuarioActual = crearCargarUsuarioActual();
const requiereAdministrador = crearRequiereRol(['administrador']);

module.exports = {
  crearRequiereAutenticacion,
  crearCargarUsuarioActual,
  crearRequiereRol,
  estaActivo,
  requiereAutenticacion,
  cargarUsuarioActual,
  requiereAdministrador,
};

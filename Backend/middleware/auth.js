const { errores } = require('./errores');
const { esUuid } = require('../validaciones/comunes');

function estaActivo(usuario) {
  return Boolean(usuario) && (usuario.activo === true || Number(usuario.activo) === 1);
}

function crearRequiereAutenticacion({ verificar }) {
  return function requiereAutenticacion(req, res, next) {
    const encabezado = req.headers.authorization;
    if (!encabezado || !encabezado.startsWith('Bearer ')) return next(errores.noAutenticado());
    const token = encabezado.slice('Bearer '.length).trim();
    if (!token) return next(errores.noAutenticado());
    try {
      const contenido = verificar(token);
      if (!contenido || !esUuid(contenido.sub)) return next(errores.noAutenticado());
      req.usuarioId = contenido.sub.toLowerCase();
      return next();
    } catch {
      return next(errores.noAutenticado());
    }
  };
}

function crearCargarUsuarioActual({ usuarioModelo }) {
  return async function cargarUsuarioActual(req, res, next) {
    try {
      const usuario = await usuarioModelo.buscarPorId(req.usuarioId);
      if (!estaActivo(usuario)) return next(errores.noAutenticado());
      req.usuario = usuario;
      return next();
    } catch (error) { return next(error); }
  };
}

function crearRequiereRol(roles, { usuarioModelo }) {
  const cargarUsuario = crearCargarUsuarioActual({ usuarioModelo });
  return function requiereRol(req, res, next) {
    cargarUsuario(req, res, (error) => {
      if (error) return next(error);
      if (!roles.includes(req.usuario.rol)) return next(errores.noAutorizado());
      return next();
    });
  };
}

module.exports = { crearRequiereAutenticacion, crearCargarUsuarioActual, crearRequiereRol, estaActivo };

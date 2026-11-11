const { verificarToken } = require('../servicios/token');
const { errores } = require('./errores');
const usuarioModelo = require('../modelos/usuarioModelo');

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
      const id = Number(contenido.sub);
      if (!Number.isInteger(id) || id <= 0) {
        return next(errores.noAutenticado());
      }
      req.usuarioId = id;
      return next();
    } catch {
      return next(errores.noAutenticado());
    }
  };
}

function crearCargarUsuarioActual({ buscarUsuario = usuarioModelo.buscarPorId } = {}) {
  return async function cargarUsuarioActual(req, res, next) {
    try {
      const usuario = await buscarUsuario(req.usuarioId);
      if (!usuario) {
        return next(errores.noAutenticado());
      }
      req.usuario = usuario;
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

function crearRequiereRol(roles, { buscarUsuario = usuarioModelo.buscarPorId } = {}) {
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
  requiereAutenticacion,
  cargarUsuarioActual,
  requiereAdministrador,
};

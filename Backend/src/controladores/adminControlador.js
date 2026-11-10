const { ErrorApi, errores } = require('../middleware/errores');
const usuarioModelo = require('../modelos/usuarioModelo');
const ventaModelo = require('../modelos/ventaModelo');
const { usuarioPublico } = require('../servicios/serializadores');
const { filtrarVentasValidas } = require('../servicios/registros');
const {
  calcularResumen,
  agruparPorCategoria,
  agruparPorPeriodo,
} = require('../servicios/estadisticas');
const { predecirDemanda } = require('../servicios/prediccion');
const { validarCambioRol, validarAgrupacion } = require('../validaciones/admin');
const { validarRangoFechas, validarHorizonte } = require('../validaciones/ventas');

async function listarUsuarios(req, res, next) {
  try {
    const usuarios = await usuarioModelo.listar();
    return res.json({ usuarios: usuarios.map(usuarioPublico) });
  } catch (error) {
    return next(error);
  }
}

async function cambiarRol(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return next(errores.noEncontrado('El usuario indicado no existe.'));
    }

    const { campos, rol } = validarCambioRol(req.body);
    if (Object.keys(campos).length > 0) {
      return next(errores.validacion(campos));
    }

    if (id === Number(req.usuario.id)) {
      return next(
        new ErrorApi(403, 'NO_AUTORIZADO', 'Un administrador no puede modificar su propio rol.')
      );
    }

    const destino = await usuarioModelo.buscarPorId(id);
    if (!destino) {
      return next(errores.noEncontrado('El usuario indicado no existe.'));
    }

    const actualizado = await usuarioModelo.actualizarRol(id, rol);
    return res.json({ usuario: usuarioPublico(actualizado) });
  } catch (error) {
    return next(error);
  }
}

async function estadisticasVentas(req, res, next) {
  try {
    const { campos, rango } = validarRangoFechas(req.query);
    const resultadoAgrupacion = validarAgrupacion(req.query.agrupacion);
    Object.assign(campos, resultadoAgrupacion.campos);
    if (Object.keys(campos).length > 0) {
      return next(errores.validacion(campos));
    }

    const filas = await ventaModelo.listarGlobal(rango);
    const { validas } = filtrarVentasValidas(filas);

    return res.json({
      periodo: { desde: rango.desde, hasta: rango.hasta },
      agrupacion: resultadoAgrupacion.agrupacion,
      grupos: agruparPorPeriodo(validas, resultadoAgrupacion.agrupacion),
      totales: calcularResumen(validas),
      por_categoria: agruparPorCategoria(validas),
    });
  } catch (error) {
    return next(error);
  }
}

async function prediccionesDemanda(req, res, next) {
  try {
    const { campos, horizonte } = validarHorizonte(req.query.horizonte);
    if (Object.keys(campos).length > 0) {
      return next(errores.validacion(campos));
    }

    const filas = await ventaModelo.listarGlobal({});
    const { validas } = filtrarVentasValidas(filas);

    return res.json(predecirDemanda(validas, { horizonte }));
  } catch (error) {
    return next(error);
  }
}

module.exports = { listarUsuarios, cambiarRol, estadisticasVentas, prediccionesDemanda };

const { ErrorApi, errores } = require('../middleware/errores');
const { esUuid } = require('../validaciones/comunes');
const usuarioModelo = require('../modelos/usuarioModelo');
const ventaModelo = require('../modelos/ventaModelo');
const { usuarioPublico } = require('../servicios/serializadores');
const { filtrarVentasValidas } = require('../servicios/registros');
const { estadisticasAdmin } = require('../servicios/estadisticas');
const { predecirTodasLasCategorias } = require('../servicios/prediccion');
const {
  validarCambioRol,
  validarAgrupacion,
  validarClienteId,
} = require('../validaciones/admin');
const { validarRangoFechas } = require('../validaciones/ventas');

async function listarUsuarios(req, res, next) {
  try {
    const usuarios = await usuarioModelo.listar();
    return res.json({
      usuarios: usuarios.map((usuario) => ({
        ...usuarioPublico(usuario),
        creado_en: usuario.creado_en,
        actualizado_en: usuario.actualizado_en,
      })),
    });
  } catch (error) {
    return next(error);
  }
}

async function cambiarRol(req, res, next) {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id.trim().toLowerCase() : '';
    if (!esUuid(id)) {
      return next(errores.noEncontrado('El usuario indicado no existe.'));
    }

    const { campos, rol } = validarCambioRol(req.body);
    if (Object.keys(campos).length > 0) {
      return next(errores.validacion(campos));
    }

    if (id === req.usuario.id) {
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

function contarExcluidosPorPropietario(invalidas) {
  const mapa = new Map();
  for (const { fila } of invalidas) {
    const propietarioId = fila && fila.propietario_id;
    if (typeof propietarioId === 'string' && esUuid(propietarioId)) {
      mapa.set(propietarioId, (mapa.get(propietarioId) || 0) + 1);
    }
  }
  return mapa;
}

async function estadisticasVentas(req, res, next) {
  try {
    const { campos, rango } = validarRangoFechas(req.query);
    const agrupacion = validarAgrupacion(req.query.agrupacion);
    Object.assign(campos, agrupacion.campos);
    if (Object.keys(campos).length > 0) {
      return next(errores.validacion(campos));
    }

    const [filas, usuarios] = await Promise.all([
      ventaModelo.listarGlobal(rango),
      usuarioModelo.listar(),
    ]);
    const { validas, invalidas } = filtrarVentasValidas(filas);

    return res.json(
      estadisticasAdmin(validas, usuarios, {
        desde: rango.desde,
        hasta: rango.hasta,
        agrupacion: agrupacion.agrupacion,
        registrosExcluidos: invalidas.length,
        excluidosPorPropietario: contarExcluidosPorPropietario(invalidas),
      })
    );
  } catch (error) {
    return next(error);
  }
}

async function prediccionesDemanda(req, res, next) {
  try {
    const { campos, clienteId } = validarClienteId(req.query.cliente_id);
    if (Object.keys(campos).length > 0) {
      return next(errores.validacion(campos));
    }

    const cliente = await usuarioModelo.buscarPorId(clienteId);
    if (!cliente) {
      return next(errores.noEncontrado('El cliente indicado no existe.'));
    }

    const filas = await ventaModelo.listarPorPropietario(clienteId, {});
    const { validas } = filtrarVentasValidas(filas);

    return res.json({
      cliente: usuarioPublico(cliente),
      predicciones: predecirTodasLasCategorias(validas),
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { listarUsuarios, cambiarRol, estadisticasVentas, prediccionesDemanda };

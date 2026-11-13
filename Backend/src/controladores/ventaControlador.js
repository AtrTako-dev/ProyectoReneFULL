const { errores } = require('../middleware/errores');
const { redondear } = require('../validaciones/comunes');
const {
  validarCreacionVenta,
  validarTotalDeclarado,
  validarRangoFechas,
  validarPaginacion,
} = require('../validaciones/ventas');
const { validarAgrupacion } = require('../validaciones/admin');
const ventaModelo = require('../modelos/ventaModelo');
const productoModelo = require('../modelos/productoModelo');
const { filtrarVentasValidas } = require('../servicios/registros');
const { estadisticasCliente } = require('../servicios/estadisticas');
const { predecirTodasLasCategorias } = require('../servicios/prediccion');
const { ventaPublica } = require('../servicios/serializadores');

async function crear(req, res, next) {
  try {
    const { campos, datos } = validarCreacionVenta(req.body);
    if (Object.keys(campos).length > 0) {
      return next(errores.validacion(campos));
    }

    const producto = await productoModelo.buscarPorId(datos.productoId);
    if (!producto || Number(producto.activo) !== 1) {
      return next(errores.noEncontrado('El producto indicado no existe en el catálogo.'));
    }

    const precioCatalogo = Number(producto.precio_actual_mxn);
    if (Math.abs(redondear(datos.precioUnitario) - redondear(precioCatalogo)) > 0.01) {
      return next(
        errores.validacion({
          precio_unitario_mxn: 'El precio no coincide con el registrado para el producto',
        })
      );
    }

    validarTotalDeclarado(req.body.total_mxn, precioCatalogo, datos.cantidad, campos);
    if (Object.keys(campos).length > 0) {
      return next(errores.validacion(campos));
    }

    if (datos.claveIdempotencia) {
      const existente = await ventaModelo.buscarPorClaveIdempotencia(
        req.usuario.id,
        datos.claveIdempotencia
      );
      if (existente) {
        return res.json({ venta: ventaPublica(existente) });
      }
    }

    try {
      const venta = await ventaModelo.insertar({
        propietarioId: req.usuario.id,
        fecha: datos.fecha,
        productoId: producto.producto_id,
        precioUnitarioMxn: precioCatalogo,
        cantidad: datos.cantidad,
        // El total siempre lo calcula el servidor.
        totalMxn: redondear(precioCatalogo * datos.cantidad),
        claveIdempotencia: datos.claveIdempotencia,
      });
      return res.status(201).json({ venta: ventaPublica(venta) });
    } catch (error) {
      if (error && error.code === 'ER_DUP_ENTRY' && datos.claveIdempotencia) {
        const existente = await ventaModelo.buscarPorClaveIdempotencia(
          req.usuario.id,
          datos.claveIdempotencia
        );
        if (existente) {
          return res.json({ venta: ventaPublica(existente) });
        }
      }
      throw error;
    }
  } catch (error) {
    return next(error);
  }
}

async function listarMias(req, res, next) {
  try {
    const { campos, rango } = validarRangoFechas(req.query);
    const paginacion = validarPaginacion(req.query);
    Object.assign(campos, paginacion.campos);
    if (Object.keys(campos).length > 0) {
      return next(errores.validacion(campos));
    }

    // El propietario se deriva de la sesión; cualquier id de la consulta se ignora.
    const filas = await ventaModelo.listarPaginaPorPropietario(
      req.usuario.id,
      rango,
      paginacion.paginacion
    );
    const total = await ventaModelo.contarPorPropietario(req.usuario.id, rango);
    const { validas, invalidas } = filtrarVentasValidas(filas);

    return res.json({
      items: validas.map(ventaPublica),
      total,
      limite: paginacion.paginacion.limite,
      desplazamiento: paginacion.paginacion.desplazamiento,
      registros_excluidos: invalidas.length,
    });
  } catch (error) {
    return next(error);
  }
}

async function estadisticasMias(req, res, next) {
  try {
    const { campos, rango } = validarRangoFechas(req.query);
    const agrupacion = validarAgrupacion(req.query.agrupacion);
    Object.assign(campos, agrupacion.campos);
    if (Object.keys(campos).length > 0) {
      return next(errores.validacion(campos));
    }

    const filas = await ventaModelo.listarPorPropietario(req.usuario.id, rango);
    const { validas, invalidas } = filtrarVentasValidas(filas);

    return res.json(
      estadisticasCliente(validas, {
        desde: rango.desde,
        hasta: rango.hasta,
        agrupacion: agrupacion.agrupacion,
        registrosExcluidos: invalidas.length,
      })
    );
  } catch (error) {
    return next(error);
  }
}

async function prediccionesMias(req, res, next) {
  try {
    const filas = await ventaModelo.listarPorPropietario(req.usuario.id, {});
    const { validas } = filtrarVentasValidas(filas);
    return res.json({
      predicciones: predecirTodasLasCategorias(validas),
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { crear, listarMias, estadisticasMias, prediccionesMias };

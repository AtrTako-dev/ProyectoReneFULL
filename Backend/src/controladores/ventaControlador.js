const { errores } = require('../middleware/errores');
const { redondear } = require('../validaciones/comunes');
const {
  validarCreacionVenta,
  validarTotalDeclarado,
  validarRangoFechas,
  validarHorizonte,
} = require('../validaciones/ventas');
const ventaModelo = require('../modelos/ventaModelo');
const productoModelo = require('../modelos/productoModelo');
const { filtrarVentasValidas } = require('../servicios/registros');
const { calcularResumen, agruparPorCategoria } = require('../servicios/estadisticas');
const { predecirDemanda } = require('../servicios/prediccion');
const { ventaPublica } = require('../servicios/serializadores');

async function crear(req, res, next) {
  try {
    const { campos, datos } = validarCreacionVenta(req.body);
    if (Object.keys(campos).length > 0) {
      return next(errores.validacion(campos));
    }

    const producto = await productoModelo.buscarPorId(datos.productoId);
    if (!producto) {
      return next(errores.noEncontrado('El producto indicado no existe.'));
    }

    const precioCatalogo = Number(producto.precio_unitario_mxn);
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

    const venta = await ventaModelo.insertar({
      usuarioId: req.usuarioId,
      fecha: datos.fecha,
      productoId: Number(producto.producto_id),
      producto: producto.producto,
      categoria: producto.categoria,
      precioUnitarioMxn: precioCatalogo,
      cantidad: datos.cantidad,
      totalMxn: redondear(precioCatalogo * datos.cantidad),
    });

    return res.status(201).json({ venta: ventaPublica(venta) });
  } catch (error) {
    return next(error);
  }
}

async function listarMias(req, res, next) {
  try {
    const { campos, rango } = validarRangoFechas(req.query);
    if (Object.keys(campos).length > 0) {
      return next(errores.validacion(campos));
    }

    const filas = await ventaModelo.listarPorUsuario(req.usuarioId, rango);
    const { validas } = filtrarVentasValidas(filas);

    return res.json({
      total: validas.length,
      ventas: validas.map(ventaPublica),
    });
  } catch (error) {
    return next(error);
  }
}

async function estadisticasMias(req, res, next) {
  try {
    const { campos, rango } = validarRangoFechas(req.query);
    if (Object.keys(campos).length > 0) {
      return next(errores.validacion(campos));
    }

    const filas = await ventaModelo.listarPorUsuario(req.usuarioId, rango);
    const { validas } = filtrarVentasValidas(filas);
    const resumen = calcularResumen(validas);

    return res.json({
      periodo: { desde: rango.desde, hasta: rango.hasta },
      ...resumen,
      por_categoria: agruparPorCategoria(validas),
    });
  } catch (error) {
    return next(error);
  }
}

async function prediccionesMias(req, res, next) {
  try {
    const { campos, horizonte } = validarHorizonte(req.query.horizonte);
    if (Object.keys(campos).length > 0) {
      return next(errores.validacion(campos));
    }

    const filas = await ventaModelo.listarPorUsuario(req.usuarioId, {});
    const { validas } = filtrarVentasValidas(filas);

    return res.json(predecirDemanda(validas, { horizonte }));
  } catch (error) {
    return next(error);
  }
}

module.exports = { crear, listarMias, estadisticasMias, prediccionesMias };

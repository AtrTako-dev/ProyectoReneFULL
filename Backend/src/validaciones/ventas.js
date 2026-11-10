const {
  esObjeto,
  fechaValida,
  fechaOpcional,
  enteroPositivo,
  numeroNoNegativo,
  redondear,
} = require('./comunes');

const DIAS_MAXIMOS_CONSULTA = 730;

function validarCreacionVenta(cuerpo) {
  const campos = {};
  if (!esObjeto(cuerpo)) {
    campos.cuerpo = 'El cuerpo debe ser un objeto JSON';
    return { campos, datos: null };
  }

  const fecha = fechaValida(cuerpo.fecha, 'fecha', campos);
  const productoId = enteroPositivo(cuerpo.producto_id, 'producto_id', campos, 'El producto');
  const cantidad = enteroPositivo(cuerpo.cantidad, 'cantidad', campos, 'La cantidad');
  const precioUnitario = numeroNoNegativo(
    cuerpo.precio_unitario_mxn,
    'precio_unitario_mxn',
    campos,
    'El precio unitario'
  );

  if (precioUnitario !== null && cantidad !== null) {
    if (precioUnitario === 0) {
      campos.precio_unitario_mxn = 'El precio unitario debe ser mayor que 0';
    }
  }

  return {
    campos,
    datos: { fecha, productoId, cantidad, precioUnitario },
  };
}

function validarTotalDeclarado(totalDeclarado, precioUnitario, cantidad, campos) {
  if (totalDeclarado === undefined || totalDeclarado === null || totalDeclarado === '') {
    return;
  }
  const numero = typeof totalDeclarado === 'string' ? Number(totalDeclarado) : totalDeclarado;
  if (typeof numero !== 'number' || !Number.isFinite(numero)) {
    campos.total_mxn = 'El total debe ser un número válido';
    return;
  }
  if (Math.abs(redondear(numero) - redondear(precioUnitario * cantidad)) > 0.01) {
    campos.total_mxn = 'El total no coincide con precio unitario × cantidad';
  }
}

function validarRangoFechas(consulta) {
  const campos = {};
  const desde = fechaOpcional(consulta.desde, 'desde', campos);
  const hasta = fechaOpcional(consulta.hasta, 'hasta', campos);

  if (desde && hasta && desde > hasta) {
    campos.desde = 'La fecha inicial no puede ser posterior a la fecha final';
  }

  if (desde && hasta) {
    const dias = (Date.parse(hasta) - Date.parse(desde)) / (24 * 60 * 60 * 1000);
    if (dias > DIAS_MAXIMOS_CONSULTA) {
      campos.rango = `El rango de fechas no puede superar ${DIAS_MAXIMOS_CONSULTA} días`;
    }
  }

  return { campos, rango: { desde, hasta } };
}

function validarHorizonte(valor) {
  const campos = {};
  const horizonte = enteroPositivo(valor, 'horizonte', campos, 'El horizonte');
  if (horizonte !== null && horizonte > 90) {
    campos.horizonte = 'El horizonte no puede superar 90 días';
    return { campos, horizonte: null };
  }
  return { campos, horizonte };
}

module.exports = {
  DIAS_MAXIMOS_CONSULTA,
  validarCreacionVenta,
  validarTotalDeclarado,
  validarRangoFechas,
  validarHorizonte,
};

const {
  esObjeto,
  fechaValida,
  fechaOpcional,
  enteroEnRango,
  numeroPositivo,
  productoIdValido,
  uuidOpcional,
  redondear,
  CANTIDAD_MAXIMA,
  PRECIO_MAXIMO_MXN,
} = require('./comunes');

const DIAS_MAXIMOS_CONSULTA = 730;
const LIMITE_PREDETERMINADO = 100;
const LIMITE_MAXIMO = 500;

function validarCreacionVenta(cuerpo) {
  const campos = {};
  if (!esObjeto(cuerpo)) {
    campos.cuerpo = 'El cuerpo debe ser un objeto JSON';
    return { campos, datos: null };
  }

  // El propietario siempre se deriva de la sesión autenticada.
  if (Object.prototype.hasOwnProperty.call(cuerpo, 'propietario_id')) {
    campos.propietario_id = 'El propietario se toma de la sesión autenticada';
  }
  if (Object.prototype.hasOwnProperty.call(cuerpo, 'usuario_id')) {
    campos.usuario_id = 'El propietario se toma de la sesión autenticada';
  }
  if (Object.prototype.hasOwnProperty.call(cuerpo, 'importacion_id')) {
    campos.importacion_id = 'Las ventas de importación se cargan con el script de demostración';
  }
  if (Object.prototype.hasOwnProperty.call(cuerpo, 'id_origen')) {
    campos.id_origen = 'El identificador de origen solo aplica a ventas importadas';
  }

  const fecha = fechaValida(cuerpo.fecha, 'fecha', campos);
  const productoId = productoIdValido(cuerpo.producto_id, 'producto_id', campos);
  const cantidad = enteroEnRango(cuerpo.cantidad, 'cantidad', campos, {
    minimo: 1,
    maximo: CANTIDAD_MAXIMA,
    etiqueta: 'La cantidad',
  });
  const precioUnitario = numeroPositivo(
    cuerpo.precio_unitario_mxn,
    'precio_unitario_mxn',
    campos,
    { maximo: PRECIO_MAXIMO_MXN, etiqueta: 'El precio unitario' }
  );
  const claveIdempotencia = uuidOpcional(
    cuerpo.clave_idempotencia,
    'clave_idempotencia',
    campos
  );

  return {
    campos,
    datos: { fecha, productoId, cantidad, precioUnitario, claveIdempotencia },
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

function validarPaginacion(consulta) {
  const campos = {};
  const sinLimite =
    consulta.limite === undefined || consulta.limite === null || consulta.limite === '';
  const sinDesplazamiento =
    consulta.desplazamiento === undefined ||
    consulta.desplazamiento === null ||
    consulta.desplazamiento === '';
  const limite = sinLimite
    ? LIMITE_PREDETERMINADO
    : enteroEnRango(consulta.limite, 'limite', campos, {
        minimo: 1,
        maximo: LIMITE_MAXIMO,
        etiqueta: 'El límite',
      });
  const desplazamiento = sinDesplazamiento
    ? 0
    : enteroEnRango(consulta.desplazamiento, 'desplazamiento', campos, {
        minimo: 0,
        maximo: Number.MAX_SAFE_INTEGER,
        etiqueta: 'El desplazamiento',
      });

  return { campos, paginacion: { limite, desplazamiento } };
}

module.exports = {
  DIAS_MAXIMOS_CONSULTA,
  LIMITE_PREDETERMINADO,
  LIMITE_MAXIMO,
  validarCreacionVenta,
  validarTotalDeclarado,
  validarRangoFechas,
  validarPaginacion,
};

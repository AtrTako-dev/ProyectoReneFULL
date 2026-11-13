const { aCentavos } = require('./dinero');
const { esFechaValida, parseFecha, diferenciaDias, hoyIso } = require('./fechas');

const FORMATO_PRODUCTO = /^[A-Z]{1,3}[0-9]{3}$/;
const FORMATO_ID_ORIGEN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/;
const FORMATO_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const FORMATO_CONJUNTO = /^[a-z0-9_]{3,80}$/;

function esObjeto(valor) {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor);
}

function texto(valor, campo, minimo, maximo, problemas) {
  if (typeof valor !== 'string') {
    problemas.push({ campo, mensaje: `${campo} debe ser texto.` });
    return null;
  }
  const limpio = valor.trim();
  if (limpio.length < minimo || limpio.length > maximo) {
    problemas.push({
      campo,
      mensaje: `${campo} debe tener entre ${minimo} y ${maximo} caracteres.`,
    });
    return null;
  }
  return limpio;
}

function entero(valor, campo, minimo, maximo, problemas) {
  const numero = typeof valor === 'string' ? Number(valor) : valor;
  if (!Number.isInteger(numero) || numero < minimo || numero > maximo) {
    problemas.push({
      campo,
      mensaje: `${campo} debe ser un entero entre ${minimo} y ${maximo}.`,
    });
    return null;
  }
  return numero;
}

function importe(valor, campo, maximoCentavos, problemas) {
  try {
    const centavos = aCentavos(valor, campo);
    if (centavos <= 0 || centavos > maximoCentavos) {
      problemas.push({
        campo,
        mensaje: `${campo} debe ser mayor que cero y no superar ${maximoCentavos / 100}.`,
      });
      return null;
    }
    return centavos;
  } catch (error) {
    problemas.push({ campo, mensaje: error.message });
    return null;
  }
}

function normalizarEmail(valor) {
  return typeof valor === 'string' ? valor.trim().toLowerCase() : '';
}

function emailValido(valor) {
  const limpio = normalizarEmail(valor);
  return limpio.length >= 3 && limpio.length <= 254 && FORMATO_CORREO.test(limpio);
}

function validarMetadataDemo(metadata, { archivo, cantidadFilas } = {}) {
  const problemas = [];
  if (!esObjeto(metadata)) {
    return [{ archivo, campo: 'metadata', mensaje: 'metadata debe ser un objeto.' }];
  }

  const conjunto = texto(metadata.conjunto, 'conjunto', 3, 80, problemas);
  if (conjunto && !FORMATO_CONJUNTO.test(conjunto)) {
    problemas.push({
      campo: 'conjunto',
      mensaje: 'conjunto solo puede contener minúsculas, números y guion bajo.',
    });
  }
  texto(metadata.perfil_demanda, 'perfil_demanda', 1, 80, problemas);
  if (metadata.moneda !== 'MXN') {
    problemas.push({ campo: 'moneda', mensaje: 'moneda debe ser MXN.' });
  }
  if (metadata.datos_simulados !== true) {
    problemas.push({
      campo: 'datos_simulados',
      mensaje: 'datos_simulados debe ser true; no se cargan datos reales.',
    });
  }
  const registros = entero(metadata.cantidad_registros, 'cantidad_registros', 1, 100000, problemas);
  if (registros !== null && registros !== cantidadFilas) {
    problemas.push({
      campo: 'cantidad_registros',
      mensaje: `cantidad_registros (${registros}) no coincide con las filas (${cantidadFilas}).`,
    });
  }
  if (!esFechaValida(metadata.periodo_inicio)) {
    problemas.push({ campo: 'periodo_inicio', mensaje: 'periodo_inicio no es una fecha válida.' });
  }
  if (!esFechaValida(metadata.periodo_fin)) {
    problemas.push({ campo: 'periodo_fin', mensaje: 'periodo_fin no es una fecha válida.' });
  }
  if (
    esFechaValida(metadata.periodo_inicio) &&
    esFechaValida(metadata.periodo_fin) &&
    metadata.periodo_fin < metadata.periodo_inicio
  ) {
    problemas.push({
      campo: 'periodo_fin',
      mensaje: 'periodo_fin no puede ser anterior a periodo_inicio.',
    });
  }

  return problemas.map((problema) => ({ archivo, ...problema }));
}

function validarVentaImportada(fila, { archivo, indice, metadata, hoy = hoyIso() } = {}) {
  const problemas = [];
  if (!esObjeto(fila)) {
    return {
      datos: null,
      problemas: [{ archivo, fila: indice, campo: 'registro', mensaje: 'La fila debe ser un objeto.' }],
    };
  }

  const idOrigen = texto(fila.id_venta, 'id_venta', 1, 32, problemas);
  if (idOrigen && !FORMATO_ID_ORIGEN.test(idOrigen)) {
    problemas.push({
      campo: 'id_venta',
      mensaje: 'id_venta debe ser un código de texto sin espacios (por ejemplo D01-066).',
    });
  }

  const productoId = texto(fila.producto_id, 'producto_id', 1, 20, problemas);
  if (productoId && !FORMATO_PRODUCTO.test(productoId)) {
    problemas.push({
      campo: 'producto_id',
      mensaje: 'producto_id debe conservar el código de texto, por ejemplo B003.',
    });
  }

  const producto = texto(fila.producto, 'producto', 1, 160, problemas);
  const categoria = texto(fila.categoria, 'categoria', 1, 80, problemas);

  let fecha = null;
  if (!esFechaValida(fila.fecha)) {
    problemas.push({ campo: 'fecha', mensaje: 'fecha debe tener formato YYYY-MM-DD y ser real.' });
  } else if (fila.fecha < '2000-01-01') {
    problemas.push({ campo: 'fecha', mensaje: 'fecha no puede ser anterior a 2000-01-01.' });
  } else if (fila.fecha > hoy) {
    problemas.push({ campo: 'fecha', mensaje: 'fecha no puede estar en el futuro.' });
  } else if (
    esObjeto(metadata) &&
    esFechaValida(metadata.periodo_inicio) &&
    esFechaValida(metadata.periodo_fin) &&
    (fila.fecha < metadata.periodo_inicio || fila.fecha > metadata.periodo_fin)
  ) {
    problemas.push({
      campo: 'fecha',
      mensaje: 'fecha está fuera del periodo declarado en metadata.',
    });
  } else {
    fecha = fila.fecha;
  }

  const precioCentavos = importe(fila.precio_unitario_mxn, 'precio_unitario_mxn', 100000000, problemas);
  const cantidad = entero(fila.cantidad, 'cantidad', 1, 10000, problemas);
  const totalCentavos = importe(fila.total_mxn, 'total_mxn', 1000000000, problemas);

  if (
    precioCentavos !== null &&
    cantidad !== null &&
    totalCentavos !== null &&
    totalCentavos !== precioCentavos * cantidad
  ) {
    problemas.push({
      campo: 'total_mxn',
      mensaje: 'total_mxn debe ser exactamente precio_unitario_mxn × cantidad.',
    });
  }

  const datos =
    problemas.length === 0
      ? {
          idOrigen,
          fecha,
          productoId,
          producto,
          categoria,
          precioCentavos,
          cantidad,
          totalCentavos,
        }
      : null;

  return {
    datos,
    problemas: problemas.map((problema) => ({ archivo, fila: indice, ...problema })),
  };
}

function validarVentaBd(fila, catalogo = null) {
  const problemas = [];
  if (!fila || typeof fila !== 'object') {
    return { valida: false, problemas: ['registro'] };
  }

  if (!Number.isInteger(Number(fila.id_venta)) || Number(fila.id_venta) <= 0) {
    problemas.push('id_venta');
  }
  if (!Number.isInteger(Number(fila.usuario_id)) || Number(fila.usuario_id) <= 0) {
    problemas.push('usuario_id');
  }
  if (!esFechaValida(fila.fecha) || fila.fecha > hoyIso()) problemas.push('fecha');
  if (typeof fila.producto_id !== 'string' || !FORMATO_PRODUCTO.test(fila.producto_id)) {
    problemas.push('producto_id');
  }
  if (typeof fila.producto !== 'string' || fila.producto.trim().length === 0) {
    problemas.push('producto');
  }
  if (typeof fila.categoria !== 'string' || fila.categoria.trim().length === 0) {
    problemas.push('categoria');
  }

  let precioCentavos = null;
  try {
    precioCentavos = aCentavos(fila.precio_unitario_mxn, 'precio_unitario_mxn');
    if (precioCentavos <= 0) problemas.push('precio_unitario_mxn');
  } catch {
    problemas.push('precio_unitario_mxn');
  }

  const cantidad = Number(fila.cantidad);
  if (!Number.isInteger(cantidad) || cantidad <= 0) problemas.push('cantidad');

  let totalCentavos = null;
  try {
    totalCentavos = aCentavos(fila.total_mxn, 'total_mxn');
    if (totalCentavos <= 0) problemas.push('total_mxn');
  } catch {
    problemas.push('total_mxn');
  }

  if (
    precioCentavos !== null &&
    Number.isInteger(cantidad) &&
    totalCentavos !== null &&
    totalCentavos !== precioCentavos * cantidad
  ) {
    problemas.push('total_mxn');
  }

  if (fila.id_origen !== undefined && fila.id_origen !== null) {
    if (
      typeof fila.id_origen !== 'string' ||
      fila.id_origen.trim().length === 0 ||
      fila.id_origen.trim().length > 32
    ) {
      problemas.push('id_origen');
    }
  }

  if (catalogo && typeof fila.producto_id === 'string') {
    const productoCatalogo = catalogo.get(fila.producto_id);
    if (!productoCatalogo) {
      problemas.push('producto_id');
    } else {
      if (productoCatalogo.producto !== fila.producto) problemas.push('producto');
      if (productoCatalogo.categoria !== fila.categoria) problemas.push('categoria');
    }
  }

  return { valida: problemas.length === 0, problemas: [...new Set(problemas)] };
}

function validarRangoConsulta({ desde, hasta } = {}, { maximoDias = 730 } = {}) {
  const problemas = [];
  if (desde !== undefined && desde !== null && desde !== '') {
    if (!esFechaValida(desde)) {
      problemas.push({ campo: 'desde', mensaje: 'desde debe ser una fecha YYYY-MM-DD válida.' });
    }
  }
  if (hasta !== undefined && hasta !== null && hasta !== '') {
    if (!esFechaValida(hasta)) {
      problemas.push({ campo: 'hasta', mensaje: 'hasta debe ser una fecha YYYY-MM-DD válida.' });
    }
  }
  if (problemas.length === 0 && desde && hasta) {
    if (desde > hasta) {
      problemas.push({ campo: 'hasta', mensaje: 'hasta no puede ser anterior a desde.' });
    } else {
      const dias = diferenciaDias(desde, hasta);
      if (dias > maximoDias) {
        problemas.push({
          campo: 'rango',
          mensaje: `El rango no puede superar ${maximoDias} días.`,
        });
      }
    }
  }
  return { valida: problemas.length === 0, problemas };
}

function esFechaDeHoyOFutura(fecha, hoy = hoyIso()) {
  const parsed = parseFecha(fecha);
  return parsed !== null && fecha > hoy;
}

module.exports = {
  FORMATO_PRODUCTO,
  FORMATO_ID_ORIGEN,
  FORMATO_CONJUNTO,
  esObjeto,
  normalizarEmail,
  emailValido,
  validarMetadataDemo,
  validarVentaImportada,
  validarVentaBd,
  validarRangoConsulta,
  esFechaDeHoyOFutura,
};

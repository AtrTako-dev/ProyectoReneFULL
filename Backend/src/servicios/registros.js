const {
  FORMATO_FECHA,
  FORMATO_PRODUCTO,
  FORMATO_UUID,
  CANTIDAD_MAXIMA,
  PRECIO_MAXIMO_MXN,
  TOTAL_MAXIMO_MXN,
  redondear,
} = require('../validaciones/comunes');

const TOLERANCIA_TOTAL = 0.01;
const FECHA_MINIMA = '2000-01-01';

function esNumeroFinito(valor) {
  return typeof valor === 'number' && Number.isFinite(valor);
}

function numero(valor) {
  if (typeof valor === 'number') {
    return valor;
  }
  if (typeof valor === 'string' && valor.trim() !== '') {
    return Number(valor);
  }
  return NaN;
}

function fechaDeHoy() {
  const ahora = new Date();
  return new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

function sumarDias(fechaTexto, dias) {
  const fecha = new Date(`${fechaTexto}T00:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

// Valida una fila leida de MySQL contra el modelo logico acordado con Ismael.
// Las filas invalidas se excluyen de listados, estadisticas y predicciones.
function validarRegistroVenta(fila, { hoy = fechaDeHoy() } = {}) {
  const problemas = [];
  if (!fila || typeof fila !== 'object') {
    return { valida: false, problemas: ['registro'] };
  }

  const id = numero(fila.id);
  if (!Number.isInteger(id) || id <= 0) problemas.push('id');

  if (typeof fila.propietario_id !== 'string' || !FORMATO_UUID.test(fila.propietario_id)) {
    problemas.push('propietario_id');
  }

  if (typeof fila.fecha !== 'string' || !FORMATO_FECHA.test(fila.fecha)) {
    problemas.push('fecha');
  } else {
    const [anio, mes, dia] = fila.fecha.split('-').map(Number);
    const fecha = new Date(Date.UTC(anio, mes - 1, dia));
    if (
      fecha.getUTCFullYear() !== anio ||
      fecha.getUTCMonth() !== mes - 1 ||
      fecha.getUTCDate() !== dia
    ) {
      problemas.push('fecha');
    } else if (fila.fecha < FECHA_MINIMA || fila.fecha > sumarDias(hoy, 1)) {
      problemas.push('fecha');
    }
  }

  if (typeof fila.producto_id !== 'string' || !FORMATO_PRODUCTO.test(fila.producto_id)) {
    problemas.push('producto_id');
  }

  if (typeof fila.producto !== 'string' || fila.producto.trim() === '') {
    problemas.push('producto');
  }
  if (typeof fila.categoria !== 'string' || fila.categoria.trim() === '') {
    problemas.push('categoria');
  }

  const precio = numero(fila.precio_unitario_mxn);
  if (!esNumeroFinito(precio) || precio <= 0 || precio > PRECIO_MAXIMO_MXN) {
    problemas.push('precio_unitario_mxn');
  }

  const cantidad = numero(fila.cantidad);
  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > CANTIDAD_MAXIMA) {
    problemas.push('cantidad');
  }

  const total = numero(fila.total_mxn);
  if (!esNumeroFinito(total) || total <= 0 || total > TOTAL_MAXIMO_MXN) {
    problemas.push('total_mxn');
  } else if (esNumeroFinito(precio) && Number.isInteger(cantidad)) {
    if (Math.abs(redondear(total) - redondear(precio * cantidad)) > TOLERANCIA_TOTAL) {
      problemas.push('total_mxn');
    }
  }

  const importacionId = fila.importacion_id;
  const idOrigen = fila.id_origen;
  const tieneImportacion = importacionId !== null && importacionId !== undefined;
  const tieneOrigen = idOrigen !== null && idOrigen !== undefined;
  if (tieneImportacion !== tieneOrigen) {
    problemas.push('importacion_id');
    problemas.push('id_origen');
  }
  if (
    tieneOrigen &&
    (typeof idOrigen !== 'string' || idOrigen.trim().length < 1 || idOrigen.trim().length > 64)
  ) {
    problemas.push('id_origen');
  }

  if (
    fila.clave_idempotencia !== null &&
    fila.clave_idempotencia !== undefined &&
    (typeof fila.clave_idempotencia !== 'string' ||
      !FORMATO_UUID.test(fila.clave_idempotencia))
  ) {
    problemas.push('clave_idempotencia');
  }

  return { valida: problemas.length === 0, problemas };
}

function filtrarVentasValidas(filas, opciones) {
  const validas = [];
  const invalidas = [];
  for (const fila of filas) {
    const resultado = validarRegistroVenta(fila, opciones);
    if (resultado.valida) {
      validas.push(fila);
    } else {
      invalidas.push({ fila, problemas: resultado.problemas });
    }
  }
  return { validas, invalidas };
}

module.exports = { validarRegistroVenta, filtrarVentasValidas, fechaDeHoy, sumarDias };

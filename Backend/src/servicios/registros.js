const { redondear } = require('../validaciones/comunes');
const { FORMATO_FECHA } = require('../validaciones/comunes');

function esNumeroFinito(valor) {
  return typeof valor === 'number' && Number.isFinite(valor);
}

function validarRegistroVenta(fila) {
  const problemas = [];
  if (!fila || typeof fila !== 'object') {
    return { valida: false, problemas: ['registro'] };
  }

  const id = Number(fila.id_venta);
  if (!Number.isInteger(id) || id <= 0) problemas.push('id_venta');

  const usuarioId = Number(fila.usuario_id);
  if (!Number.isInteger(usuarioId) || usuarioId <= 0) problemas.push('usuario_id');

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
    }
  }

  const productoId = Number(fila.producto_id);
  if (!Number.isInteger(productoId) || productoId <= 0) problemas.push('producto_id');

  if (typeof fila.producto !== 'string' || fila.producto.trim() === '') problemas.push('producto');
  if (typeof fila.categoria !== 'string' || fila.categoria.trim() === '') problemas.push('categoria');

  const precio = Number(fila.precio_unitario_mxn);
  if (!esNumeroFinito(precio) || precio < 0) problemas.push('precio_unitario_mxn');

  const cantidad = Number(fila.cantidad);
  if (!Number.isInteger(cantidad) || cantidad < 1) problemas.push('cantidad');

  const total = Number(fila.total_mxn);
  if (!esNumeroFinito(total) || total < 0) {
    problemas.push('total_mxn');
  } else if (esNumeroFinito(precio) && Number.isInteger(cantidad)) {
    if (Math.abs(redondear(total) - redondear(precio * cantidad)) > 0.01) {
      problemas.push('total_mxn');
    }
  }

  return { valida: problemas.length === 0, problemas };
}

function filtrarVentasValidas(filas) {
  const validas = [];
  const invalidas = [];
  for (const fila of filas) {
    const resultado = validarRegistroVenta(fila);
    if (resultado.valida) {
      validas.push(fila);
    } else {
      invalidas.push({ fila, problemas: resultado.problemas });
    }
  }
  return { validas, invalidas };
}

module.exports = { validarRegistroVenta, filtrarVentasValidas };

const { redondear } = require('../validaciones/comunes');

function calcularResumen(ventas) {
  let totalVentas = 0;
  let totalUnidades = 0;
  let totalImporte = 0;

  for (const venta of ventas) {
    totalVentas += 1;
    totalUnidades += Number(venta.cantidad);
    totalImporte += Number(venta.total_mxn);
  }

  return {
    total_ventas: totalVentas,
    total_unidades: totalUnidades,
    total_importe_mxn: redondear(totalImporte),
  };
}

function totalesBreves(resumen) {
  return {
    ventas: resumen.total_ventas,
    unidades: resumen.total_unidades,
    importe_mxn: resumen.total_importe_mxn,
  };
}

function agruparPorCategoria(ventas) {
  const acumulado = new Map();
  for (const venta of ventas) {
    const clave = venta.categoria;
    const actual = acumulado.get(clave) || { categoria: clave, ventas: 0, unidades: 0, importe_mxn: 0 };
    actual.ventas += 1;
    actual.unidades += Number(venta.cantidad);
    actual.importe_mxn += Number(venta.total_mxn);
    acumulado.set(clave, actual);
  }
  return [...acumulado.values()]
    .map((grupo) => ({ ...grupo, importe_mxn: redondear(grupo.importe_mxn) }))
    .sort((a, b) => a.categoria.localeCompare(b.categoria));
}

function etiquetaMes(fechaTexto) {
  return fechaTexto.slice(0, 7);
}

function etiquetaSemana(fechaTexto) {
  const fecha = new Date(`${fechaTexto}T00:00:00Z`);
  const diaSemana = (fecha.getUTCDay() + 6) % 7;
  fecha.setUTCDate(fecha.getUTCDate() - diaSemana + 3);

  const primerJueves = new Date(Date.UTC(fecha.getUTCFullYear(), 0, 4));
  const diaPrimerJueves = (primerJueves.getUTCDay() + 6) % 7;
  primerJueves.setUTCDate(primerJueves.getUTCDate() - diaPrimerJueves + 3);

  const semana = 1 + Math.round((fecha - primerJueves) / (7 * 24 * 60 * 60 * 1000));
  return `${fecha.getUTCFullYear()}-W${String(semana).padStart(2, '0')}`;
}

function agruparPorPeriodo(ventas, agrupacion) {
  const etiquetar = agrupacion === 'mes' ? etiquetaMes : etiquetaSemana;
  const acumulado = new Map();

  for (const venta of ventas) {
    const clave = etiquetar(venta.fecha);
    const actual = acumulado.get(clave) || { etiqueta: clave, ventas: 0, unidades: 0, importe_mxn: 0 };
    actual.ventas += 1;
    actual.unidades += Number(venta.cantidad);
    actual.importe_mxn += Number(venta.total_mxn);
    acumulado.set(clave, actual);
  }

  return [...acumulado.values()]
    .map((grupo) => ({ ...grupo, importe_mxn: redondear(grupo.importe_mxn) }))
    .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta));
}

module.exports = {
  calcularResumen,
  totalesBreves,
  agruparPorCategoria,
  agruparPorPeriodo,
  etiquetaSemana,
  etiquetaMes,
};

const { redondear } = require('../validaciones/comunes');

const VENTANA_DIAS = 90;
const MINIMO_VENTAS = 14;
const MILISEGUNDOS_DIA = 24 * 60 * 60 * 1000;

function sumarDias(fechaTexto, dias) {
  const fecha = new Date(`${fechaTexto}T00:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

function diferenciaDias(desde, hasta) {
  return Math.round(
    (Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / MILISEGUNDOS_DIA
  );
}

function diaSemana(fechaTexto) {
  return new Date(`${fechaTexto}T00:00:00Z`).getUTCDay();
}

function fechaDeHoy() {
  const ahora = new Date();
  return new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

function sinBaseSuficiente() {
  return {
    tipo: 'estimacion',
    estado: 'sin_base_suficiente',
    mensaje: 'No hay ventas suficientes para estimar la demanda del periodo solicitado.',
    valores: [],
  };
}

function predecirDemanda(ventas, { horizonte, fechaReferencia = fechaDeHoy() }) {
  if (!Array.isArray(ventas) || ventas.length === 0) {
    return sinBaseSuficiente();
  }

  const fechaInicioVentana = sumarDias(fechaReferencia, -(VENTANA_DIAS - 1));
  const ventana = ventas.filter(
    (venta) => venta.fecha >= fechaInicioVentana && venta.fecha <= fechaReferencia
  );

  if (ventana.length < MINIMO_VENTAS) {
    return sinBaseSuficiente();
  }

  const unidadesPorFecha = new Map();
  for (const venta of ventana) {
    unidadesPorFecha.set(venta.fecha, (unidadesPorFecha.get(venta.fecha) || 0) + Number(venta.cantidad));
  }

  const primeraFecha = [...unidadesPorFecha.keys()].sort()[0];
  const diasObservados = Math.max(1, diferenciaDias(primeraFecha, fechaReferencia) + 1);
  const totalUnidades = [...unidadesPorFecha.values()].reduce((suma, valor) => suma + valor, 0);
  const promedioDiario = totalUnidades / diasObservados;

  const unidadesPorDiaSemana = new Map();
  const conteoPorDiaSemana = new Map();
  for (const [fecha, unidades] of unidadesPorFecha.entries()) {
    const dia = diaSemana(fecha);
    unidadesPorDiaSemana.set(dia, (unidadesPorDiaSemana.get(dia) || 0) + unidades);
    conteoPorDiaSemana.set(dia, (conteoPorDiaSemana.get(dia) || 0) + 1);
  }

  const factorPorDiaSemana = new Map();
  for (const [dia, unidades] of unidadesPorDiaSemana.entries()) {
    const promedioDia = unidades / conteoPorDiaSemana.get(dia);
    factorPorDiaSemana.set(dia, promedioDiario > 0 ? promedioDia / promedioDiario : 1);
  }

  const valores = [];
  for (let i = 1; i <= horizonte; i += 1) {
    const fecha = sumarDias(fechaReferencia, i);
    const factor = factorPorDiaSemana.get(diaSemana(fecha)) ?? 1;
    valores.push({ fecha, cantidad_estimada: redondear(promedioDiario * factor) });
  }

  return {
    tipo: 'estimacion',
    estado: 'ok',
    unidad: 'unidades',
    periodo: { desde: valores[0].fecha, hasta: valores[valores.length - 1].fecha },
    valores,
    nota: 'Estimación calculada con el promedio diario y el comportamiento por día de la semana de las ventas registradas.',
  };
}

module.exports = { predecirDemanda, fechaDeHoy, VENTANA_DIAS, MINIMO_VENTAS };

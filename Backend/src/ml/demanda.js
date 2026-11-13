const { configuracion } = require('../config/entornoDatos');
const { redondear2 } = require('../datos/dinero');
const {
  esFechaValida,
  finSemana,
  inicioSemana,
  mesDeFecha,
  semanasCompletas,
  sumarDias,
} = require('../datos/fechas');
const { entrenarRidge, errorAbsolutoMedio, predecirRidge } = require('./regresion');

const ALGORITMO = 'Ridge';
const VARIABLES = [
  'indice_semana',
  'mes',
  'unidades_semana_anterior',
  'promedio_4_semanas_previas',
  'unidades_misma_semana_mes_anterior',
];
const ADVERTENCIA =
  'Estimación semanal de unidades basada en ventas históricas. ' +
  'No garantiza la demanda futura.';

function rangoSemana(inicio) {
  return { inicio, fin: sumarDias(inicio, 6) };
}

function construirSerieSemanal(ventas, { categoria = null } = {}) {
  const filas = ventas.filter((venta) => {
    if (!venta || !esFechaValida(venta.fecha)) return false;
    if (categoria !== null && venta.categoria !== categoria) return false;
    return Number.isFinite(Number(venta.cantidad)) && Number(venta.cantidad) >= 0;
  });

  if (filas.length === 0) {
    return {
      categoria: categoria === null ? 'total' : categoria,
      semanas: [],
      unidades: [],
      fecha_min: null,
      fecha_max: null,
      fecha_objetivo: null,
      filas: 0,
    };
  }

  const fechas = filas.map((venta) => venta.fecha).sort();
  const fechaMin = fechas[0];
  const fechaMax = fechas[fechas.length - 1];
  const semanas = semanasCompletas(fechaMin, fechaMax).map((semana) => ({
    ...semana,
    etiqueta: `${semana.inicio} / ${semana.fin}`,
  }));

  const unidades = semanas.map((semana) =>
    filas
      .filter((venta) => venta.fecha >= semana.inicio && venta.fecha <= semana.fin)
      .reduce((suma, venta) => suma + Number(venta.cantidad), 0)
  );

  return {
    categoria: categoria === null ? 'total' : categoria,
    semanas,
    unidades,
    fecha_min: fechaMin,
    fecha_max: fechaMax,
    fecha_objetivo: sumarDias(inicioSemana(fechaMax), 7),
    filas: filas.length,
  };
}

function crearMuestras(serie) {
  const muestras = [];
  for (let indice = 4; indice < serie.unidades.length; indice += 1) {
    const semana = serie.semanas[indice];
    const unidades = serie.unidades;
    const promedio4 =
      (unidades[indice - 4] +
        unidades[indice - 3] +
        unidades[indice - 2] +
        unidades[indice - 1]) /
      4;
    muestras.push({
      fila: [
        1,
        indice,
        mesDeFecha(semana.inicio),
        unidades[indice - 1],
        promedio4,
        unidades[indice - 4],
      ],
      objetivo: unidades[indice],
      linea_base: unidades[indice - 1],
      semana,
    });
  }
  return muestras;
}

function resumenFuente(ventas) {
  const conocidos = ventas.filter((venta) => typeof venta.es_demostracion === 'boolean');
  if (conocidos.length === 0) return 'no_clasificado';
  const simuladas = conocidos.filter((venta) => venta.es_demostracion).length;
  if (simuladas === conocidos.length) return 'datos_simulados_de_demostracion';
  if (simuladas === 0) return 'datos_registrados_por_usuarios';
  return 'mixto';
}

function baseResultado(serie, estado, mensaje, extras = {}) {
  return {
    tipo: 'estimacion',
    estado,
    mensaje,
    categoria: serie.categoria,
    unidad: 'unidades',
    periodicidad: 'semanal',
    periodo: null,
    valores: [],
    modelo: null,
    evaluacion: null,
    datos: {
      fuente: resumenFuente(serie.ventas || []),
      filas_utilizadas: serie.filas || 0,
      semanas_disponibles: serie.semanas.length,
      semanas_con_unidades: serie.unidades.filter((unidad) => unidad > 0).length,
      semanas: serie.semanas,
    },
    ...extras,
  };
}

function predecirCategoria(
  ventas,
  {
    categoria = null,
    fechaCorte = null,
    minimoSemanas = configuracion.ml.minimoSemanas,
    minimoSemanasConUnidades = configuracion.ml.minimoSemanasConUnidades,
    semanasEvaluacion = configuracion.ml.semanasEvaluacion,
    alpha = configuracion.ml.alpha,
    horizonteSemanas = 1,
  } = {}
) {
  if (!Number.isInteger(horizonteSemanas) || horizonteSemanas < 1 || horizonteSemanas > 13) {
    throw new Error('horizonteSemanas debe ser un entero entre 1 y 13.');
  }
  if (!Number.isInteger(semanasEvaluacion) || semanasEvaluacion < 1) {
    throw new Error('semanasEvaluacion debe ser un entero positivo.');
  }
  if (fechaCorte !== null && !esFechaValida(fechaCorte)) {
    throw new Error('fechaCorte debe ser una fecha YYYY-MM-DD válida.');
  }

  const serie = construirSerieSemanal(ventas, { categoria });
  const conFuente = { ...serie, ventas };
  const semanasConUnidades = serie.unidades.filter((unidad) => unidad > 0).length;

  if (
    serie.semanas.length < minimoSemanas ||
    semanasConUnidades < minimoSemanasConUnidades
  ) {
    return baseResultado(conFuente, 'sin_base_suficiente', 'No hay historial suficiente para estimar la demanda.', {
      requerido: {
        semanas: minimoSemanas,
        semanas_con_unidades: minimoSemanasConUnidades,
      },
    });
  }

  const muestras = crearMuestras(serie);
  if (muestras.length <= semanasEvaluacion || muestras.length - semanasEvaluacion < 4) {
    return baseResultado(
      conFuente,
      'sin_base_suficiente',
      'No hay suficientes semanas completas para entrenar y evaluar el modelo.'
    );
  }

  const corte = muestras.length - semanasEvaluacion;
  const entrenamiento = muestras.slice(0, corte);
  const evaluacion = muestras.slice(corte);
  let coeficientesEvaluacion;
  try {
    coeficientesEvaluacion = entrenarRidge(
      entrenamiento.map((muestra) => muestra.fila),
      entrenamiento.map((muestra) => muestra.objetivo),
      { alpha }
    );
  } catch {
    return baseResultado(
      conFuente,
      'sin_base_suficiente',
      'No fue posible entrenar el modelo con el historial disponible.'
    );
  }
  const estimadosEvaluacion = evaluacion.map((muestra) =>
    Math.max(0, predecirRidge(coeficientesEvaluacion, muestra.fila))
  );
  const realesEvaluacion = evaluacion.map((muestra) => muestra.objetivo);
  const baseEvaluacion = evaluacion.map((muestra) => muestra.linea_base);
  const maeModelo = errorAbsolutoMedio(realesEvaluacion, estimadosEvaluacion);
  const maeLineaBase = errorAbsolutoMedio(realesEvaluacion, baseEvaluacion);
  const superaLineaBase = maeModelo < maeLineaBase;
  const mejora =
    maeLineaBase === 0 ? 0 : ((maeLineaBase - maeModelo) / maeLineaBase) * 100;

  const evaluacionResultado = {
    metodo: 'MAE',
    corte: 'cronologico',
    semanas_entrenamiento: entrenamiento.length,
    semanas_evaluacion: evaluacion.length,
    mae_modelo: redondear2(maeModelo),
    mae_linea_base: redondear2(maeLineaBase),
    mejora_mae_porcentaje: redondear2(mejora),
    supera_linea_base: superaLineaBase,
    linea_base: 'unidades de la semana anterior',
  };

  if (!superaLineaBase) {
    return baseResultado(
      conFuente,
      'modelo_no_supera_linea_base',
      'El modelo no supera la línea base en la evaluación cronológica; no se emite una estimación.',
      { evaluacion: evaluacionResultado }
    );
  }

  let coeficientesFinales;
  try {
    coeficientesFinales = entrenarRidge(
      muestras.map((muestra) => muestra.fila),
      muestras.map((muestra) => muestra.objetivo),
      { alpha }
    );
  } catch {
    return baseResultado(
      conFuente,
      'sin_base_suficiente',
      'No fue posible ajustar el modelo final con el historial disponible.'
    );
  }

  const unidadesFuturas = [...serie.unidades];
  const semanasFuturas = [...serie.semanas];
  let inicio = fechaCorte
    ? sumarDias(inicioSemana(fechaCorte), 7)
    : serie.fecha_objetivo;

  const valores = [];
  for (let paso = 0; paso < horizonteSemanas; paso += 1) {
    const indice = unidadesFuturas.length;
    const promedio4 =
      (unidadesFuturas[indice - 4] +
        unidadesFuturas[indice - 3] +
        unidadesFuturas[indice - 2] +
        unidadesFuturas[indice - 1]) /
      4;
    const fila = [
      1,
      indice,
      mesDeFecha(inicio),
      unidadesFuturas[indice - 1],
      promedio4,
      unidadesFuturas[indice - 4],
    ];
    const estimado = Math.max(0, redondear2(predecirRidge(coeficientesFinales, fila)));
    const semana = { inicio, fin: finSemana(inicio), etiqueta: `${inicio} / ${finSemana(inicio)}` };
    valores.push({
      fecha: semana.inicio,
      semana_inicio: semana.inicio,
      semana_fin: semana.fin,
      etiqueta: semana.etiqueta,
      cantidad_estimada: estimado,
    });
    unidadesFuturas.push(estimado);
    semanasFuturas.push(semana);
    inicio = sumarDias(inicio, 7);
  }

  return {
    ...baseResultado(conFuente, 'ok', 'Estimación calculada y evaluada cronológicamente.', {
      periodo: {
        desde: valores[0].semana_inicio,
        hasta: valores[valores.length - 1].semana_fin,
      },
      valores,
      modelo: {
        algoritmo: ALGORITMO,
        alpha,
        variables: VARIABLES,
        semanas_entrenamiento: muestras.length,
        semanas_evaluacion: semanasEvaluacion,
      },
      evaluacion: evaluacionResultado,
      advertencia: ADVERTENCIA,
    }),
  };
}

function resumenCategorias(resultados) {
  const resumen = {
    ok: 0,
    sin_base_suficiente: 0,
    modelo_no_supera_linea_base: 0,
  };
  for (const resultado of resultados) {
    resumen[resultado.estado] = (resumen[resultado.estado] || 0) + 1;
  }
  return resumen;
}

function predecirPorCategoria(ventas, opciones = {}) {
  const categorias = [...new Set(ventas.map((venta) => venta.categoria).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b, 'es')
  );
  return categorias.map((categoria) =>
    predecirCategoria(ventas, { ...opciones, categoria })
  );
}

function predecirDemandaAgregada(ventas, opciones = {}) {
  return predecirCategoria(ventas, { ...opciones, categoria: null });
}

function predecirDemanda(ventas, { horizonte = 7, ...opciones } = {}) {
  const horizonteDias = Number(horizonte);
  if (!Number.isInteger(horizonteDias) || horizonteDias < 1 || horizonteDias > 90) {
    throw new Error('horizonte debe ser un entero entre 1 y 90 días.');
  }
  const horizonteSemanas = Math.ceil(horizonteDias / 7);
  const porCategoria = predecirPorCategoria(ventas, { ...opciones, horizonteSemanas });
  const agregada = predecirDemandaAgregada(ventas, { ...opciones, horizonteSemanas });

  return {
    ...agregada,
    horizonte_dias: horizonteDias,
    horizonte_semanas: horizonteSemanas,
    por_categoria: porCategoria,
    resumen_categorias: resumenCategorias(porCategoria),
  };
}

module.exports = {
  ALGORITMO,
  VARIABLES,
  ADVERTENCIA,
  construirSerieSemanal,
  crearMuestras,
  predecirCategoria,
  predecirPorCategoria,
  predecirDemandaAgregada,
  predecirDemanda,
  resumenCategorias,
};

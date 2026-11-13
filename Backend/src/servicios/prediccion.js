const { redondear } = require('../validaciones/comunes');
const { inicioSemana, sumarDias, etiquetaSemana } = require('./estadisticas');

const VARIABLES = [
  'indice_semana',
  'mes',
  'unidades_semana_anterior',
  'promedio_4_semanas_previas',
  'unidades_misma_semana_mes_anterior',
];
const ALGORITMO = 'Ridge';
const ALPHA = 1.0;
const MINIMO_SEMANAS_COMPLETAS = 12;
const MINIMO_SEMANAS_CON_UNIDADES = 8;
const SEMANAS_EVALUACION = 5;
const MINIMO_MUESTRAS_ENTRENAMIENTO = 5;
// Cada muestra consume 4 semanas previas; por eso 12 semanas completas no
// alcanzan: se necesitan al menos 14 para tener 5 + 5 observaciones.
const MINIMO_OBSERVACIONES = SEMANAS_EVALUACION + MINIMO_MUESTRAS_ENTRENAMIENTO;
const ADVERTENCIA =
  'Estimación semanal de unidades basada en ventas históricas. No garantiza la demanda futura.';

function fechaDeHoy() {
  const ahora = new Date();
  return new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

function semanasCompletas(minFecha, maxFecha) {
  let inicio = inicioSemana(minFecha);
  if (inicio < minFecha) {
    inicio = sumarDias(inicio, 7);
  }
  const semanas = [];
  while (sumarDias(inicio, 6) <= maxFecha) {
    semanas.push(inicio);
    inicio = sumarDias(inicio, 7);
  }
  return semanas;
}

function construirSerie(ventas, categoria) {
  const categoriaLimpia = typeof categoria === 'string' ? categoria.trim() : '';
  if (!categoriaLimpia) {
    throw new Error('La categoría es obligatoria.');
  }
  const fechas = ventas.map((venta) => venta.fecha).sort();
  if (fechas.length === 0) {
    return { categoria: categoriaLimpia, semanas: [], unidades: [] };
  }
  const semanas = semanasCompletas(fechas[0], fechas.at(-1));
  const indicePorSemana = new Map(semanas.map((semana, indice) => [semana, indice]));
  const unidades = new Array(semanas.length).fill(0);

  for (const venta of ventas) {
    if (venta.categoria !== categoriaLimpia) {
      continue;
    }
    const indice = indicePorSemana.get(inicioSemana(venta.fecha));
    if (indice !== undefined) {
      unidades[indice] += Number(venta.cantidad);
    }
  }
  return { categoria: categoriaLimpia, semanas, unidades };
}

function promedio(valores) {
  if (valores.length === 0) {
    return 0;
  }
  return valores.reduce((suma, valor) => suma + valor, 0) / valores.length;
}

function construirMuestras(serie, semanasEvaluacion) {
  const { semanas, unidades } = serie;
  const x = [];
  const y = [];
  const indices = [];

  for (let indice = 4; indice < semanas.length; indice += 1) {
    x.push([
      indice,
      Number(semanas[indice].slice(5, 7)),
      unidades[indice - 1],
      promedio(unidades.slice(indice - 4, indice)),
      unidades[indice - 4],
    ]);
    y.push(unidades[indice]);
    indices.push(indice);
  }

  if (x.length < semanasEvaluacion + MINIMO_MUESTRAS_ENTRENAMIENTO) {
    throw new Error('No hay suficientes observaciones para entrenar y evaluar.');
  }

  const corte = x.length - semanasEvaluacion;
  const lineaBase = indices.map((indice) => unidades[indice - 1]);
  return {
    xEntrenamiento: x.slice(0, corte),
    yEntrenamiento: y.slice(0, corte),
    xEvaluacion: x.slice(corte),
    yEvaluacion: y.slice(corte),
    lineaBaseEvaluacion: lineaBase.slice(corte),
    semanasEvaluacion: indices.slice(corte).map((indice) => semanas[indice]),
    xTodas: x,
    yTodas: y,
  };
}

function vectorObjetivo(serie) {
  const { semanas, unidades } = serie;
  const indice = semanas.length;
  const siguienteSemana = sumarDias(semanas.at(-1), 7);
  return [
    [
      indice,
      Number(siguienteSemana.slice(5, 7)),
      unidades.at(-1),
      promedio(unidades.slice(-4)),
      unidades.at(-4),
    ],
  ];
}

function resolverSistema(matriz, vector) {
  const n = vector.length;
  const a = matriz.map((fila, i) => [...fila, vector[i]]);

  for (let columna = 0; columna < n; columna += 1) {
    let pivote = columna;
    for (let fila = columna + 1; fila < n; fila += 1) {
      if (Math.abs(a[fila][columna]) > Math.abs(a[pivote][columna])) {
        pivote = fila;
      }
    }
    if (Math.abs(a[pivote][columna]) < 1e-12) {
      return null;
    }
    [a[columna], a[pivote]] = [a[pivote], a[columna]];

    for (let fila = columna + 1; fila < n; fila += 1) {
      const factor = a[fila][columna] / a[columna][columna];
      for (let k = columna; k <= n; k += 1) {
        a[fila][k] -= factor * a[columna][k];
      }
    }
  }

  const solucion = new Array(n).fill(0);
  for (let fila = n - 1; fila >= 0; fila -= 1) {
    let suma = a[fila][n];
    for (let columna = fila + 1; columna < n; columna += 1) {
      suma -= a[fila][columna] * solucion[columna];
    }
    solucion[fila] = suma / a[fila][fila];
  }
  return solucion;
}

// Ridge con intercepción, equivalente a sklearn.linear_model.Ridge(alpha=1.0):
// se centran X e y, se penalizan solo los pesos y luego se calcula el intercepto.
function ajustarRidge(x, y, alpha = ALPHA) {
  if (x.length === 0) {
    return null;
  }
  const nVariables = x[0].length;
  const mediasX = new Array(nVariables).fill(0);
  for (let j = 0; j < nVariables; j += 1) {
    mediasX[j] = promedio(x.map((fila) => fila[j]));
  }
  const mediaY = promedio(y);

  const centrada = x.map((fila) => fila.map((valor, j) => valor - mediasX[j]));
  const yCentrada = y.map((valor) => valor - mediaY);

  const matriz = Array.from({ length: nVariables }, () => new Array(nVariables).fill(0));
  const vector = new Array(nVariables).fill(0);
  for (let i = 0; i < centrada.length; i += 1) {
    for (let j = 0; j < nVariables; j += 1) {
      vector[j] += centrada[i][j] * yCentrada[i];
      for (let k = 0; k < nVariables; k += 1) {
        matriz[j][k] += centrada[i][j] * centrada[i][k];
      }
    }
  }
  for (let j = 0; j < nVariables; j += 1) {
    matriz[j][j] += alpha;
  }

  const pesos = resolverSistema(matriz, vector);
  if (!pesos) {
    return null;
  }
  const intercepto = mediaY - pesos.reduce((suma, peso, j) => suma + peso * mediasX[j], 0);
  return (fila) =>
    intercepto + fila.reduce((suma, valor, j) => suma + pesos[j] * valor, 0);
}

function errorAbsolutoMedio(reales, estimados) {
  let suma = 0;
  for (let i = 0; i < reales.length; i += 1) {
    suma += Math.abs(reales[i] - estimados[i]);
  }
  return suma / reales.length;
}

function semanaObjetivo(serie, fechas, hoy) {
  let inicio;
  if (serie.semanas.length > 0) {
    inicio = sumarDias(serie.semanas.at(-1), 7);
  } else if (fechas.length > 0) {
    inicio = sumarDias(inicioSemana(fechas.at(-1)), 7);
  } else {
    inicio = sumarDias(inicioSemana(hoy), 7);
  }
  return {
    semana_inicio: inicio,
    semana_fin: sumarDias(inicio, 6),
    semana_iso: etiquetaSemana(inicio),
  };
}

function fuenteDatos(ventas) {
  if (ventas.length === 0) {
    return 'sin_datos';
  }
  const demostracion = ventas.map((venta) => Boolean(Number(venta.es_demostracion)));
  if (demostracion.every(Boolean)) {
    return 'datos_simulados_de_demostracion';
  }
  if (demostracion.some(Boolean)) {
    return 'datos_simulados_y_registros_propios';
  }
  return 'registros_propios';
}

function resultadoSinHistorial({
  categoria,
  periodo,
  serie,
  minimoSemanasCompletas,
  minimoSemanasConUnidades,
  motivo,
}) {
  return {
    tipo_resultado: 'sin_historial_suficiente',
    objetivo: 'unidades_vendidas_por_categoria_semana',
    unidad: 'unidades',
    categoria,
    periodo_objetivo: periodo,
    semanas_completas: serie.semanas.length,
    semanas_con_unidades: serie.unidades.filter((unidades) => unidades > 0).length,
    minimo_semanas_completas: minimoSemanasCompletas,
    minimo_semanas_con_unidades: minimoSemanasConUnidades,
    motivo,
    es_estimacion: true,
  };
}

function predecirDemandaCategoria(
  ventas,
  {
    categoria,
    hoy = fechaDeHoy(),
    minimoSemanasCompletas = MINIMO_SEMANAS_COMPLETAS,
    minimoSemanasConUnidades = MINIMO_SEMANAS_CON_UNIDADES,
    semanasEvaluacion = SEMANAS_EVALUACION,
  } = {}
) {
  const serie = construirSerie(ventas, categoria);
  const fechas = ventas.map((venta) => venta.fecha).sort();
  const periodo = semanaObjetivo(serie, fechas, hoy);
  const base = {
    categoria: serie.categoria,
    periodo,
    serie,
    minimoSemanasCompletas,
    minimoSemanasConUnidades,
  };

  if (ventas.length === 0) {
    return resultadoSinHistorial({
      ...base,
      motivo: 'No hay ventas válidas para el cliente en el periodo solicitado.',
    });
  }
  if (serie.semanas.length < minimoSemanasCompletas) {
    return resultadoSinHistorial({
      ...base,
      motivo: 'No hay suficientes semanas completas para entrenar y evaluar el modelo.',
    });
  }
  if (serie.unidades.filter((unidades) => unidades > 0).length < minimoSemanasConUnidades) {
    return resultadoSinHistorial({
      ...base,
      motivo: 'No hay suficientes semanas con unidades positivas para la categoría.',
    });
  }

  let muestras;
  try {
    muestras = construirMuestras(serie, semanasEvaluacion);
  } catch {
    return resultadoSinHistorial({
      ...base,
      motivo: 'No hay suficientes observaciones históricas para entrenar y evaluar.',
    });
  }

  const modeloEvaluacion = ajustarRidge(muestras.xEntrenamiento, muestras.yEntrenamiento);
  if (!modeloEvaluacion) {
    return resultadoSinHistorial({
      ...base,
      motivo: 'No fue posible ajustar el modelo con el historial disponible.',
    });
  }
  const prediccionEvaluacion = muestras.xEvaluacion.map((fila) =>
    Math.max(0, modeloEvaluacion(fila))
  );
  const maeModelo = errorAbsolutoMedio(muestras.yEvaluacion, prediccionEvaluacion);
  const maeLineaBase = errorAbsolutoMedio(
    muestras.yEvaluacion,
    muestras.lineaBaseEvaluacion
  );
  const metricas = {
    mae_modelo: redondear(maeModelo, 4),
    mae_linea_base: redondear(maeLineaBase, 4),
    supera_linea_base: maeModelo < maeLineaBase,
  };

  if (!metricas.supera_linea_base) {
    return {
      tipo_resultado: 'modelo_no_supera_linea_base',
      objetivo: 'unidades_vendidas_por_categoria_semana',
      unidad: 'unidades',
      categoria: serie.categoria,
      periodo_objetivo: periodo,
      metricas,
      motivo: 'El modelo no superó la línea base en la evaluación cronológica.',
      es_estimacion: true,
    };
  }

  const modeloFinal = ajustarRidge(muestras.xTodas, muestras.yTodas);
  if (!modeloFinal) {
    return resultadoSinHistorial({
      ...base,
      motivo: 'No fue posible ajustar el modelo con el historial disponible.',
    });
  }
  const estimacion = Math.max(0, modeloFinal(vectorObjetivo(serie)[0]));

  return {
    tipo_resultado: 'prediccion',
    objetivo: 'unidades_vendidas_por_categoria_semana',
    unidad: 'unidades',
    categoria: serie.categoria,
    periodo_objetivo: periodo,
    valores: {
      unidades_estimadas: redondear(estimacion, 2),
      unidades_redondeadas: Math.round(estimacion),
    },
    modelo: {
      algoritmo: ALGORITMO,
      variables: VARIABLES,
      semanas_entrenamiento: Math.max(0, serie.semanas.length - semanasEvaluacion),
      semanas_evaluacion: semanasEvaluacion,
    },
    metricas,
    es_estimacion: true,
    fuente_datos: fuenteDatos(ventas),
    advertencia: ADVERTENCIA,
  };
}

function predecirTodasLasCategorias(ventas, opciones = {}) {
  const categorias = [...new Set(ventas.map((venta) => venta.categoria))].sort();
  return categorias.map((categoria) =>
    predecirDemandaCategoria(ventas, { ...opciones, categoria })
  );
}

module.exports = {
  VARIABLES,
  ALGORITMO,
  ALPHA,
  MINIMO_SEMANAS_COMPLETAS,
  MINIMO_SEMANAS_CON_UNIDADES,
  SEMANAS_EVALUACION,
  MINIMO_MUESTRAS_ENTRENAMIENTO,
  MINIMO_OBSERVACIONES,
  ADVERTENCIA,
  fechaDeHoy,
  semanasCompletas,
  construirSerie,
  construirMuestras,
  ajustarRidge,
  predecirDemandaCategoria,
  predecirTodasLasCategorias,
};

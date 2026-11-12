const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  predecirDemandaCategoria,
  predecirTodasLasCategorias,
  semanasCompletas,
  construirSerie,
  fechaDeHoy,
  MINIMO_SEMANAS_COMPLETAS,
  MINIMO_SEMANAS_CON_UNIDADES,
  SEMANAS_EVALUACION,
  ALGORITMO,
  ALPHA,
  VARIABLES,
} = require('../src/servicios/prediccion');

const INICIO = '2026-01-05';

function sumarDias(fechaTexto, dias) {
  const fecha = new Date(`${fechaTexto}T00:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

function ventasSemanales(semanas, { categoria = 'Bebidas', desde = INICIO, unidades = 5 } = {}) {
  const ventas = [];
  for (let i = 0; i < semanas; i += 1) {
    ventas.push({
      fecha: sumarDias(desde, i * 7),
      categoria,
      producto_id: 'B003',
      producto: 'Jugo de naranja 1 L',
      cantidad: typeof unidades === 'function' ? unidades(i) : unidades,
      total_mxn: 100,
      es_demostracion: 1,
    });
  }
  return ventas;
}

test('las semanas completas excluyen la semana parcial inicial y final', () => {
  const semanas = semanasCompletas('2026-01-01', '2026-01-20');
  assert.deepEqual(semanas, ['2026-01-05', '2026-01-12']);
});

test('construirSerie suma unidades por semana y por categoría', () => {
  const ventas = [
    ...ventasSemanales(2, { unidades: 3 }),
    { fecha: '2026-01-18', categoria: 'Bebidas', cantidad: 4, total_mxn: 50 },
    { fecha: '2026-01-12', categoria: 'Higiene', cantidad: 9, total_mxn: 50 },
  ];
  const serie = construirSerie(ventas, 'Bebidas');

  assert.deepEqual(serie.semanas, ['2026-01-05', '2026-01-12']);
  assert.deepEqual(serie.unidades, [3, 7]);
});

test('sin ventas no fabrica una predicción', () => {
  const resultado = predecirDemandaCategoria([], {
    categoria: 'Bebidas',
    hoy: '2026-06-03',
  });

  assert.equal(resultado.tipo_resultado, 'sin_historial_suficiente');
  assert.equal(resultado.categoria, 'Bebidas');
  assert.equal(resultado.semanas_completas, 0);
  assert.equal(resultado.semanas_con_unidades, 0);
  assert.deepEqual(resultado.periodo_objetivo, {
    semana_inicio: '2026-06-08',
    semana_fin: '2026-06-14',
    semana_iso: '2026-W24',
  });
  assert.equal(resultado.valores, undefined);
});

test('con menos semanas completas que el mínimo no estima', () => {
  const ventas = ventasSemanales(MINIMO_SEMANAS_COMPLETAS);
  const resultado = predecirDemandaCategoria(ventas, {
    categoria: 'Bebidas',
    hoy: '2026-06-30',
  });

  assert.equal(resultado.tipo_resultado, 'sin_historial_suficiente');
  assert.equal(resultado.semanas_completas, MINIMO_SEMANAS_COMPLETAS - 1);
  assert.match(resultado.motivo, /semanas completas/);
  assert.equal(resultado.valores, undefined);
});

test('con suficientes semanas pero pocas con unidades no estima', () => {
  const ventas = ventasSemanales(6);
  // Una venta aislada en la semana 14 extiende la serie a 14 semanas completas
  // sin agregar suficientes semanas con unidades positivas.
  ventas.push({
    fecha: sumarDias(INICIO, 13 * 7),
    categoria: 'Bebidas',
    producto_id: 'B003',
    producto: 'Jugo de naranja 1 L',
    cantidad: 2,
    total_mxn: 40,
  });

  const resultado = predecirDemandaCategoria(ventas, {
    categoria: 'Bebidas',
    hoy: '2026-06-30',
  });

  assert.equal(resultado.tipo_resultado, 'sin_historial_suficiente');
  assert.ok(resultado.semanas_completas >= MINIMO_SEMANAS_COMPLETAS);
  assert.ok(resultado.semanas_con_unidades < MINIMO_SEMANAS_CON_UNIDADES);
  assert.equal(resultado.valores, undefined);
});

test('con historial suficiente devuelve un contrato explícito y no inventa valores', () => {
  const ventas = ventasSemanales(24, { unidades: (indice) => 10 + indice });
  const resultado = predecirDemandaCategoria(ventas, {
    categoria: 'Bebidas',
    hoy: '2026-07-01',
  });

  assert.ok(['prediccion', 'modelo_no_supera_linea_base'].includes(resultado.tipo_resultado));
  assert.equal(resultado.objetivo, 'unidades_vendidas_por_categoria_semana');
  assert.equal(resultado.unidad, 'unidades');
  assert.equal(resultado.categoria, 'Bebidas');
  assert.equal(resultado.es_estimacion, true);
  assert.ok(resultado.periodo_objetivo.semana_inicio);
  assert.match(resultado.periodo_objetivo.semana_iso, /^\d{4}-W\d{2}$/);

  if (resultado.tipo_resultado === 'prediccion') {
    assert.equal(resultado.modelo.algoritmo, ALGORITMO);
    assert.equal(ALPHA, 1);
    assert.deepEqual(resultado.modelo.variables, VARIABLES);
    assert.equal(resultado.modelo.semanas_evaluacion, SEMANAS_EVALUACION);
    assert.ok(resultado.valores.unidades_estimadas >= 0);
    assert.ok(resultado.valores.unidades_redondeadas >= 0);
    assert.ok(resultado.metricas.mae_modelo >= 0);
    assert.ok(resultado.metricas.mae_linea_base >= 0);
    assert.equal(resultado.metricas.supera_linea_base, true);
    assert.equal(resultado.fuente_datos, 'datos_simulados_de_demostracion');
    assert.ok(resultado.advertencia);
  } else {
    assert.equal(resultado.valores, undefined);
    assert.equal(resultado.metricas.supera_linea_base, false);
    assert.match(resultado.motivo, /línea base/);
  }
});

test('predice cada categoría por separado y en orden', () => {
  const ventas = [
    ...ventasSemanales(24, { categoria: 'Higiene' }),
    ...ventasSemanales(24, { categoria: 'Bebidas' }),
  ];
  const resultados = predecirTodasLasCategorias(ventas, { hoy: '2026-07-01' });

  assert.deepEqual(
    resultados.map((resultado) => resultado.categoria),
    ['Bebidas', 'Higiene']
  );
  assert.equal(resultados.length, 2);
});

test('expone las constantes del modelo acordado con Ismael', () => {
  assert.equal(MINIMO_SEMANAS_COMPLETAS, 12);
  assert.equal(MINIMO_SEMANAS_CON_UNIDADES, 8);
  assert.equal(SEMANAS_EVALUACION, 5);
  assert.equal(ALGORITMO, 'Ridge');
  assert.equal(ALPHA, 1);
  assert.equal(fechaDeHoy().length, 10);
});

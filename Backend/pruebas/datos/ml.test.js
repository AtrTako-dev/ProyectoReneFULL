const { test } = require('node:test');
const assert = require('node:assert/strict');

const { sumarDias, inicioSemana } = require('../../src/datos/fechas');
const {
  construirSerieSemanal,
  predecirCategoria,
  predecirDemanda,
} = require('../../src/ml/demanda');

const LUNES = '2025-01-06';

function ventasSemanales(cantidadSemanas, cantidad, categoria = 'Bebidas') {
  const ventas = [];
  for (let indice = 0; indice <= cantidadSemanas; indice += 1) {
    ventas.push({
      fecha: sumarDias(LUNES, indice * 7),
      categoria,
      cantidad: indice < cantidadSemanas ? cantidad(indice) : 0,
      total_mxn: 1,
      es_demostracion: true,
    });
  }
  return ventas;
}

test('construye semanas completas y no inventa la semana parcial final', () => {
  const ventas = ventasSemanales(20, () => 3);
  const serie = construirSerieSemanal(ventas, { categoria: 'Bebidas' });
  assert.equal(serie.semanas.length, 20);
  assert.equal(serie.semanas[0].inicio, inicioSemana(LUNES));
  assert.equal(serie.semanas.at(-1).fin, sumarDias(serie.semanas.at(-1).inicio, 6));
  assert.equal(serie.unidades.reduce((suma, valor) => suma + valor, 0), 60);
  assert.equal(serie.fecha_objetivo, sumarDias(inicioSemana(serie.fecha_max), 7));
});

test('emite una estimación solo cuando el modelo supera la línea base', () => {
  const ventas = ventasSemanales(20, (indice) => 10 + indice * 3);
  const resultado = predecirCategoria(ventas, {
    categoria: 'Bebidas',
    horizonteSemanas: 2,
  });
  assert.equal(resultado.estado, 'ok');
  assert.equal(resultado.evaluacion.supera_linea_base, true);
  assert.equal(resultado.evaluacion.corte, 'cronologico');
  assert.ok(resultado.evaluacion.mae_modelo < resultado.evaluacion.mae_linea_base);
  assert.equal(resultado.valores.length, 2);
  assert.ok(resultado.valores.every((valor) => valor.cantidad_estimada >= 0));
  assert.equal(resultado.periodo.desde, resultado.valores[0].semana_inicio);
});

test('no emite valores cuando el modelo no supera la línea base', () => {
  const ventas = ventasSemanales(20, () => 5);
  const resultado = predecirCategoria(ventas, { categoria: 'Bebidas' });
  assert.equal(resultado.estado, 'modelo_no_supera_linea_base');
  assert.deepEqual(resultado.valores, []);
  assert.equal(resultado.evaluacion.supera_linea_base, false);
});

test('devuelve resultado controlado si no hay historial suficiente', () => {
  const ventas = ventasSemanales(6, () => 4);
  const resultado = predecirCategoria(ventas, { categoria: 'Bebidas' });
  assert.equal(resultado.estado, 'sin_base_suficiente');
  assert.deepEqual(resultado.valores, []);
  assert.equal(resultado.periodo, null);
});

test('predecirDemanda conserva el estado controlado y agrega categorías', () => {
  const ventas = [
    ...ventasSemanales(20, (indice) => 10 + indice * 3, 'Bebidas'),
    ...ventasSemanales(20, () => 5, 'Botanas'),
  ];
  const resultado = predecirDemanda(ventas, { horizonte: 7 });
  assert.equal(resultado.horizonte_semanas, 1);
  assert.equal(resultado.por_categoria.length, 2);
  assert.ok(['ok', 'sin_base_suficiente', 'modelo_no_supera_linea_base'].includes(resultado.estado));
  for (const categoria of resultado.por_categoria) {
    if (categoria.estado !== 'ok') assert.deepEqual(categoria.valores, []);
  }
});

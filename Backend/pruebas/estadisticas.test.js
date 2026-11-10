const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  calcularResumen,
  totalesBreves,
  agruparPorCategoria,
  agruparPorPeriodo,
  etiquetaSemana,
  etiquetaMes,
} = require('../src/servicios/estadisticas');

const VENTAS = [
  { fecha: '2026-01-05', categoria: 'electronics', cantidad: 2, total_mxn: 10.5 },
  { fecha: '2026-01-20', categoria: 'electronics', cantidad: 3, total_mxn: 20 },
  { fecha: '2026-02-02', categoria: 'jewelery', cantidad: 1, total_mxn: 5.25 },
];

test('calcula totales de ventas, unidades e importe', () => {
  const resumen = calcularResumen(VENTAS);
  assert.deepEqual(resumen, {
    total_ventas: 3,
    total_unidades: 6,
    total_importe_mxn: 35.75,
  });
});

test('totalesBreves usa los nombres acordados para administración', () => {
  assert.deepEqual(totalesBreves(calcularResumen(VENTAS)), {
    ventas: 3,
    unidades: 6,
    importe_mxn: 35.75,
  });
});

test('agrupa por categoría con importes redondeados', () => {
  const grupos = agruparPorCategoria(VENTAS);
  assert.deepEqual(grupos, [
    { categoria: 'electronics', ventas: 2, unidades: 5, importe_mxn: 30.5 },
    { categoria: 'jewelery', ventas: 1, unidades: 1, importe_mxn: 5.25 },
  ]);
});

test('agrupa por mes', () => {
  const grupos = agruparPorPeriodo(VENTAS, 'mes');
  assert.deepEqual(
    grupos.map((grupo) => grupo.etiqueta),
    ['2026-01', '2026-02']
  );
  assert.equal(grupos[0].ventas, 2);
});

test('agrupa por semana ISO', () => {
  const grupos = agruparPorPeriodo(VENTAS, 'semana');
  const etiquetas = grupos.map((grupo) => grupo.etiqueta);
  assert.deepEqual(etiquetas, ['2026-W02', '2026-W04', '2026-W06']);
});

test('etiquetas de periodo', () => {
  assert.equal(etiquetaMes('2026-03-15'), '2026-03');
  assert.equal(etiquetaSemana('2026-01-05'), '2026-W02');
});

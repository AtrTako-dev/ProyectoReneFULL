const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  predecirDemanda,
  fechaDeHoy,
  MINIMO_VENTAS,
} = require('../src/servicios/prediccion');

function sumarDias(fechaTexto, dias) {
  const fecha = new Date(`${fechaTexto}T00:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

function ventasDiarias(cantidadVentas, inicio, unidades = 2) {
  const ventas = [];
  for (let i = 0; i < cantidadVentas; i += 1) {
    ventas.push({
      fecha: sumarDias(inicio, i),
      cantidad: unidades,
      total_mxn: unidades * 10,
    });
  }
  return ventas;
}

test('sin ventas no fabrica una predicción', () => {
  const resultado = predecirDemanda([], { horizonte: 7 });
  assert.equal(resultado.estado, 'sin_base_suficiente');
  assert.deepEqual(resultado.valores, []);
});

test('con pocas ventas informa que no hay base suficiente', () => {
  const hoy = fechaDeHoy();
  const ventas = ventasDiarias(MINIMO_VENTAS - 1, sumarDias(hoy, -(MINIMO_VENTAS - 2)));
  const resultado = predecirDemanda(ventas, { horizonte: 7 });

  assert.equal(resultado.estado, 'sin_base_suficiente');
  assert.deepEqual(resultado.valores, []);
});

test('con base suficiente genera una estimación con periodo y unidad', () => {
  const hoy = fechaDeHoy();
  const ventas = ventasDiarias(30, sumarDias(hoy, -29));
  const resultado = predecirDemanda(ventas, { horizonte: 7 });

  assert.equal(resultado.tipo, 'estimacion');
  assert.equal(resultado.estado, 'ok');
  assert.equal(resultado.unidad, 'unidades');
  assert.equal(resultado.valores.length, 7);
  assert.equal(resultado.periodo.desde, sumarDias(hoy, 1));
  assert.equal(resultado.periodo.hasta, sumarDias(hoy, 7));

  for (const valor of resultado.valores) {
    assert.match(valor.fecha, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(valor.cantidad_estimada >= 0);
  }
});

test('ignora ventas fuera de la ventana de los últimos 90 días', () => {
  const hoy = fechaDeHoy();
  const ventas = ventasDiarias(30, sumarDias(hoy, -400));
  const resultado = predecirDemanda(ventas, { horizonte: 3 });

  assert.equal(resultado.estado, 'sin_base_suficiente');
});

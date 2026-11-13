const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  resumenEstadisticas,
  porCategoria,
  porProducto,
  porPeriodo,
  periodoSalida,
  estadisticasCliente,
  estadisticasAdmin,
  etiquetaSemana,
  etiquetaMes,
  inicioSemana,
  finSemana,
  sumarDias,
} = require('../src/servicios/estadisticas');

const PROPIETARIO_ID = '11111111-1111-4111-8111-111111111111';
const CLIENTE_SIN_VENTAS = '22222222-2222-4222-8222-222222222222';
const ADMIN_ID = '33333333-3333-4333-8333-333333333333';

const VENTAS = [
  {
    id: 1,
    propietario_id: PROPIETARIO_ID,
    fecha: '2026-01-05',
    producto_id: 'B003',
    producto: 'Jugo de naranja 1 L',
    categoria: 'Bebidas',
    cantidad: 2,
    total_mxn: 10.5,
  },
  {
    id: 2,
    propietario_id: PROPIETARIO_ID,
    fecha: '2026-01-20',
    producto_id: 'B003',
    producto: 'Jugo de naranja 1 L',
    categoria: 'Bebidas',
    cantidad: 3,
    total_mxn: 20,
  },
  {
    id: 3,
    propietario_id: PROPIETARIO_ID,
    fecha: '2026-02-02',
    producto_id: 'H002',
    producto: 'Shampoo 400 ml',
    categoria: 'Higiene',
    cantidad: 1,
    total_mxn: 5.25,
  },
];

const USUARIOS = [
  {
    id: PROPIETARIO_ID,
    nombre: 'Mia',
    correo: 'mia@ejemplo.com',
    rol: 'cliente',
    activo: 1,
  },
  {
    id: CLIENTE_SIN_VENTAS,
    nombre: 'Luis',
    correo: 'luis@ejemplo.com',
    rol: 'cliente',
    activo: 0,
  },
  {
    id: ADMIN_ID,
    nombre: 'Admin',
    correo: 'admin@ejemplo.com',
    rol: 'administrador',
    activo: 1,
  },
];

test('calcula el resumen con transacciones, unidades e importe', () => {
  const resumen = resumenEstadisticas(VENTAS, 2);
  assert.deepEqual(resumen, {
    transacciones_validas: 3,
    unidades: 6,
    importe_mxn: 35.75,
    registros_excluidos: 2,
  });
});

test('agrupa por categoría con importes redondeados y orden estable', () => {
  assert.deepEqual(porCategoria(VENTAS), [
    { categoria: 'Bebidas', transacciones: 2, unidades: 5, importe_mxn: 30.5 },
    { categoria: 'Higiene', transacciones: 1, unidades: 1, importe_mxn: 5.25 },
  ]);
});

test('agrupa por producto de mayor a menor unidades', () => {
  assert.deepEqual(porProducto(VENTAS), [
    {
      producto_id: 'B003',
      producto: 'Jugo de naranja 1 L',
      categoria: 'Bebidas',
      transacciones: 2,
      unidades: 5,
      importe_mxn: 30.5,
    },
    {
      producto_id: 'H002',
      producto: 'Shampoo 400 ml',
      categoria: 'Higiene',
      transacciones: 1,
      unidades: 1,
      importe_mxn: 5.25,
    },
  ]);
});

test('periodos semanales usan ISO y marcan solo semanas completas', () => {
  const semanas = porPeriodo(VENTAS, 'semana', '2026-01-05', '2026-02-02');
  assert.deepEqual(
    semanas.map((semana) => semana.etiqueta),
    ['2026-W02', '2026-W04', '2026-W06']
  );
  assert.deepEqual(
    semanas.map((semana) => semana.completa),
    [true, true, false]
  );
  assert.equal(semanas[0].periodo_inicio, '2026-01-05');
  assert.equal(semanas[0].periodo_fin, '2026-01-11');
});

test('periodos mensuales se etiquetan con año y mes', () => {
  const meses = porPeriodo(VENTAS, 'mes', '2026-01-05', '2026-02-02');
  assert.deepEqual(
    meses.map((mes) => mes.etiqueta),
    ['2026-01', '2026-02']
  );
  assert.equal(meses[0].periodo_fin, '2026-01-31');
});

test('el periodo de salida usa el rango consultado o los límites de las ventas', () => {
  assert.deepEqual(periodoSalida(VENTAS, null, null, 'semana'), {
    desde: '2026-01-05',
    hasta: '2026-02-02',
    agrupacion: 'semana',
  });
  assert.deepEqual(periodoSalida(VENTAS, '2026-01-01', '2026-02-28', 'mes'), {
    desde: '2026-01-01',
    hasta: '2026-02-28',
    agrupacion: 'mes',
  });
});

test('las estadísticas de cliente solo incluyen sus ventas y el DTO acordado', () => {
  const resultado = estadisticasCliente(VENTAS, {
    agrupacion: 'semana',
    registrosExcluidos: 1,
  });

  assert.equal(resultado.unidad_cantidad, 'unidades');
  assert.deepEqual(resultado.periodo, {
    desde: '2026-01-05',
    hasta: '2026-02-02',
    agrupacion: 'semana',
  });
  assert.equal(resultado.resumen.transacciones_validas, 3);
  assert.equal(resultado.resumen.registros_excluidos, 1);
  assert.equal(resultado.por_semana.length, 3);
  assert.deepEqual(resultado.por_mes, []);
  assert.equal(resultado.por_categoria[0].categoria, 'Bebidas');
  assert.equal(resultado.por_producto[0].producto_id, 'B003');
});

test('las estadísticas administrativas agregan clientes y respetan el DTO', () => {
  const resultado = estadisticasAdmin(VENTAS, USUARIOS, {
    agrupacion: 'mes',
    registrosExcluidos: 3,
    excluidosPorPropietario: new Map([[PROPIETARIO_ID, 2]]),
  });

  assert.equal(resultado.resumen.total_clientes, 2);
  assert.equal(resultado.clientes.length, 2);
  assert.deepEqual(
    resultado.clientes.map((cliente) => cliente.correo),
    ['mia@ejemplo.com', 'luis@ejemplo.com']
  );

  const mia = resultado.clientes[0];
  assert.equal(mia.transacciones, 3);
  assert.equal(mia.unidades, 6);
  assert.equal(mia.importe_mxn, 35.75);
  assert.equal(mia.ultima_venta, '2026-02-02');
  assert.equal(mia.registros_excluidos, 2);
  assert.equal(mia.por_categoria.length, 2);

  const luis = resultado.clientes[1];
  assert.equal(luis.transacciones, 0);
  assert.equal(luis.activo, false);
  assert.deepEqual(luis.por_categoria, []);

  assert.equal(resultado.por_semana.length, 0);
  assert.equal(resultado.por_mes.length, 2);
});

test('etiquetas y límites de periodo semanal', () => {
  assert.equal(etiquetaMes('2026-03-15'), '2026-03');
  assert.equal(etiquetaSemana('2026-01-05'), '2026-W02');
  assert.equal(inicioSemana('2026-01-08'), '2026-01-05');
  assert.equal(finSemana('2026-01-08'), '2026-01-11');
  assert.equal(sumarDias('2026-01-05', 7), '2026-01-12');
});

const { obtenerPool } = require('../db/mysql');
const { ErrorNoEncontrado, ErrorRegistroInvalido, ErrorValidacionDatos } = require('./errores');
const { aCentavos, aNumero } = require('./dinero');
const {
  finMes,
  etiquetaMes,
  etiquetaSemanaIso,
  inicioSemana,
  finSemana,
} = require('./fechas');
const { validarRangoConsulta, validarVentaBd } = require('./validacion');

function validarUsuarioId(usuarioId, obligatorio = true) {
  if (usuarioId === null || usuarioId === undefined) {
    if (obligatorio) {
      throw new ErrorValidacionDatos([
        { campo: 'usuario_id', mensaje: 'usuario_id es obligatorio.' },
      ]);
    }
    return null;
  }
  const numero = Number(usuarioId);
  if (!Number.isInteger(numero) || numero <= 0) {
    throw new ErrorValidacionDatos([
      { campo: 'usuario_id', mensaje: 'usuario_id debe ser un entero positivo.' },
    ]);
  }
  return numero;
}

function validarOpcionesConsulta({ desde, hasta, limite } = {}) {
  const rango = validarRangoConsulta({ desde, hasta });
  if (!rango.valida) throw new ErrorValidacionDatos(rango.problemas);
  if (limite !== undefined && limite !== null) {
    const numero = Number(limite);
    if (!Number.isInteger(numero) || numero < 1 || numero > 50000) {
      throw new ErrorValidacionDatos([
        { campo: 'limite', mensaje: 'limite debe ser un entero entre 1 y 50000.' },
      ]);
    }
    return { desde: desde || null, hasta: hasta || null, limite: numero };
  }
  return { desde: desde || null, hasta: hasta || null, limite: null };
}

function filtroSql({ usuarioId, desde, hasta }) {
  const condiciones = [];
  const parametros = [];
  if (usuarioId !== null && usuarioId !== undefined) {
    condiciones.push('v.usuario_id = ?');
    parametros.push(usuarioId);
  }
  if (desde) {
    condiciones.push('v.fecha >= ?');
    parametros.push(desde);
  }
  if (hasta) {
    condiciones.push('v.fecha <= ?');
    parametros.push(hasta);
  }
  return {
    sql: condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '',
    parametros,
  };
}

async function obtenerCatalogo(conexion = obtenerPool()) {
  const [filas] = await conexion.execute(
    'SELECT producto_id, producto, categoria, precio_unitario_mxn FROM productos ORDER BY producto_id'
  );
  return new Map(
    filas.map((fila) => [
      fila.producto_id,
      {
        producto: fila.producto,
        categoria: fila.categoria,
        precio_unitario_mxn: fila.precio_unitario_mxn,
      },
    ])
  );
}

async function seleccionarVentas({ usuarioId, desde, hasta, limite }, conexion = obtenerPool()) {
  const filtro = filtroSql({ usuarioId, desde, hasta });
  const limiteSql = limite ? ` LIMIT ${limite}` : '';
  const [filas] = await conexion.execute(
    `SELECT v.id_venta, v.importacion_id, v.id_origen, v.usuario_id, v.fecha,
            v.producto_id, v.producto, v.categoria, v.precio_unitario_mxn,
            v.cantidad, v.total_mxn,
            COALESCE(i.es_demostracion, 0) AS es_demostracion
       FROM ventas v
       LEFT JOIN importaciones i ON i.id = v.importacion_id
       ${filtro.sql}
      ORDER BY v.fecha, v.id_venta${limiteSql}`,
    filtro.parametros
  );
  return filas;
}

function validarFilas(filas, catalogo) {
  const ventas = [];
  const excluidas = [];
  for (const fila of filas) {
    const resultado = validarVentaBd(fila, catalogo);
    if (resultado.valida) {
      ventas.push({
        ...fila,
        id_venta: Number(fila.id_venta),
        usuario_id: Number(fila.usuario_id),
        importacion_id:
          fila.importacion_id === null ? null : Number(fila.importacion_id),
        cantidad: Number(fila.cantidad),
        es_demostracion: Number(fila.es_demostracion) === 1,
      });
    } else {
      excluidas.push({
        id_venta: fila.id_venta === undefined ? null : Number(fila.id_venta),
        problemas: resultado.problemas,
      });
    }
  }
  return { ventas, excluidas };
}

async function listarVentasValidas(usuarioId, opciones = {}, conexion = obtenerPool()) {
  // null se usa únicamente en la consulta administrativa interna; undefined
  // sigue siendo un error para evitar listar ventas globales por accidente.
  const id = usuarioId === null ? null : validarUsuarioId(usuarioId);
  const filtros = validarOpcionesConsulta(opciones);
  const filas = await seleccionarVentas({ usuarioId: id, ...filtros }, conexion);
  const catalogo = await obtenerCatalogo(conexion);
  return validarFilas(filas, catalogo);
}

async function obtenerVentaValida(usuarioId, idVenta, conexion = obtenerPool()) {
  const idUsuario = validarUsuarioId(usuarioId);
  const id = Number(idVenta);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ErrorNoEncontrado('La venta indicada no existe.');
  }
  const [filas] = await conexion.execute(
    `SELECT v.id_venta, v.importacion_id, v.id_origen, v.usuario_id, v.fecha,
            v.producto_id, v.producto, v.categoria, v.precio_unitario_mxn,
            v.cantidad, v.total_mxn,
            COALESCE(i.es_demostracion, 0) AS es_demostracion
       FROM ventas v
       LEFT JOIN importaciones i ON i.id = v.importacion_id
      WHERE v.usuario_id = ? AND v.id_venta = ?`,
    [idUsuario, id]
  );
  if (filas.length === 0) {
    throw new ErrorNoEncontrado('La venta indicada no existe.');
  }
  const catalogo = await obtenerCatalogo(conexion);
  const resultado = validarVentaBd(filas[0], catalogo);
  if (!resultado.valida) {
    throw new ErrorRegistroInvalido(id, resultado.problemas);
  }
  const fila = filas[0];
  return {
    ...fila,
    id_venta: Number(fila.id_venta),
    usuario_id: Number(fila.usuario_id),
    importacion_id: fila.importacion_id === null ? null : Number(fila.importacion_id),
    cantidad: Number(fila.cantidad),
    es_demostracion: Number(fila.es_demostracion) === 1,
  };
}

async function cargarVentasParaModelo(
  { usuarioId = null, desde, hasta, limite = 50000 } = {},
  conexion = obtenerPool()
) {
  const id = validarUsuarioId(usuarioId, false);
  const filtros = validarOpcionesConsulta({ desde, hasta, limite });
  const filas = await seleccionarVentas(
    { usuarioId: id, ...filtros },
    conexion
  );
  const catalogo = await obtenerCatalogo(conexion);
  return validarFilas(filas, catalogo);
}

function calcularResumen(ventas) {
  let unidades = 0;
  let importeCentavos = 0;
  for (const venta of ventas) {
    unidades += Number(venta.cantidad);
    importeCentavos += aCentavos(venta.total_mxn, 'total_mxn');
  }
  return {
    total_ventas: ventas.length,
    total_unidades: unidades,
    total_importe_mxn: aNumero(importeCentavos),
  };
}

function agruparPorCategoria(ventas) {
  const grupos = new Map();
  for (const venta of ventas) {
    const actual = grupos.get(venta.categoria) || {
      categoria: venta.categoria,
      ventas: 0,
      unidades: 0,
      importeCentavos: 0,
    };
    actual.ventas += 1;
    actual.unidades += Number(venta.cantidad);
    actual.importeCentavos += aCentavos(venta.total_mxn, 'total_mxn');
    grupos.set(venta.categoria, actual);
  }
  return [...grupos.values()]
    .map(({ importeCentavos, ...grupo }) => ({
      ...grupo,
      importe_mxn: aNumero(importeCentavos),
    }))
    .sort((a, b) => a.categoria.localeCompare(b.categoria, 'es'));
}

function agruparPorPeriodo(ventas, agrupacion = 'semana') {
  const grupos = new Map();
  for (const venta of ventas) {
    let clave;
    let inicio;
    let fin;
    let etiqueta;
    if (agrupacion === 'mes') {
      clave = etiquetaMes(venta.fecha);
      inicio = `${clave}-01`;
      fin = finMes(inicio);
      etiqueta = clave;
    } else {
      inicio = inicioSemana(venta.fecha);
      fin = finSemana(venta.fecha);
      clave = inicio;
      etiqueta = etiquetaSemanaIso(venta.fecha);
    }
    const actual = grupos.get(clave) || {
      etiqueta,
      periodo_inicio: inicio,
      periodo_fin: fin,
      ventas: 0,
      unidades: 0,
      importeCentavos: 0,
    };
    actual.ventas += 1;
    actual.unidades += Number(venta.cantidad);
    actual.importeCentavos += aCentavos(venta.total_mxn, 'total_mxn');
    grupos.set(clave, actual);
  }
  return [...grupos.values()]
    .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta))
    .map(({ importeCentavos, ...grupo }) => ({
      ...grupo,
      importe_mxn: aNumero(importeCentavos),
    }));
}

function calcularPeriodo(ventas, filtros = {}) {
  const fechas = ventas.map((venta) => venta.fecha).sort();
  return {
    desde: filtros.desde || fechas[0] || null,
    hasta: filtros.hasta || fechas[fechas.length - 1] || null,
  };
}

function validarAgrupacion(agrupacion) {
  if (agrupacion === undefined || agrupacion === null || agrupacion === '') return 'semana';
  if (agrupacion !== 'semana' && agrupacion !== 'mes') {
    throw new ErrorValidacionDatos([
      { campo: 'agrupacion', mensaje: 'agrupacion debe ser "semana" o "mes".' },
    ]);
  }
  return agrupacion;
}

async function estadisticasCliente(usuarioId, opciones = {}, conexion = obtenerPool()) {
  const filtros = validarOpcionesConsulta(opciones);
  const { ventas, excluidas } = await listarVentasValidas(usuarioId, filtros, conexion);
  const resumen = calcularResumen(ventas);
  return {
    periodo: calcularPeriodo(ventas, filtros),
    ...resumen,
    por_categoria: agruparPorCategoria(ventas),
    por_periodo: agruparPorPeriodo(ventas, 'semana'),
    registros_excluidos: excluidas.length,
  };
}

async function estadisticasAdmin(opciones = {}, conexion = obtenerPool()) {
  const filtros = validarOpcionesConsulta(opciones);
  const agrupacion = validarAgrupacion(opciones.agrupacion);
  const { ventas, excluidas } = await listarVentasValidas(null, filtros, conexion);
  const resumen = calcularResumen(ventas);
  return {
    periodo: calcularPeriodo(ventas, filtros),
    agrupacion,
    grupos: agruparPorPeriodo(ventas, agrupacion),
    totales: {
      ventas: resumen.total_ventas,
      unidades: resumen.total_unidades,
      importe_mxn: resumen.total_importe_mxn,
    },
    por_categoria: agruparPorCategoria(ventas),
    registros_excluidos: excluidas.length,
  };
}

module.exports = {
  obtenerCatalogo,
  listarVentasValidas,
  obtenerVentaValida,
  cargarVentasParaModelo,
  calcularResumen,
  agruparPorCategoria,
  agruparPorPeriodo,
  calcularPeriodo,
  estadisticasCliente,
  estadisticasAdmin,
};

const { redondear } = require('../validaciones/comunes');

const DIAS_SEMANA = 7;
const MILISEGUNDOS_DIA = 24 * 60 * 60 * 1000;

function dinero(valor) {
  return redondear(Number(valor));
}

function sumarDias(fechaTexto, dias) {
  const fecha = new Date(`${fechaTexto}T00:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

function inicioSemana(fechaTexto) {
  const fecha = new Date(`${fechaTexto}T00:00:00Z`);
  const diaSemana = (fecha.getUTCDay() + 6) % 7;
  fecha.setUTCDate(fecha.getUTCDate() - diaSemana);
  return fecha.toISOString().slice(0, 10);
}

function finSemana(fechaTexto) {
  return sumarDias(inicioSemana(fechaTexto), 6);
}

function etiquetaSemana(fechaTexto) {
  const fecha = new Date(`${inicioSemana(fechaTexto)}T00:00:00Z`);
  const diaSemana = (fecha.getUTCDay() + 6) % 7;
  fecha.setUTCDate(fecha.getUTCDate() - diaSemana + 3);

  const primerJueves = new Date(Date.UTC(fecha.getUTCFullYear(), 0, 4));
  const diaPrimerJueves = (primerJueves.getUTCDay() + 6) % 7;
  primerJueves.setUTCDate(primerJueves.getUTCDate() - diaPrimerJueves + 3);

  const semana = 1 + Math.round((fecha - primerJueves) / (DIAS_SEMANA * MILISEGUNDOS_DIA));
  return `${fecha.getUTCFullYear()}-W${String(semana).padStart(2, '0')}`;
}

function etiquetaMes(fechaTexto) {
  return fechaTexto.slice(0, 7);
}

function inicioMes(fechaTexto) {
  return `${fechaTexto.slice(0, 7)}-01`;
}

function finMes(fechaTexto) {
  const [anio, mes] = fechaTexto.split('-').map(Number);
  const ultimoDia = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  return `${fechaTexto.slice(0, 7)}-${String(ultimoDia).padStart(2, '0')}`;
}

function periodoDe(fechaTexto, agrupacion) {
  if (agrupacion === 'semana') {
    return {
      inicio: inicioSemana(fechaTexto),
      fin: finSemana(fechaTexto),
      etiqueta: etiquetaSemana(fechaTexto),
    };
  }
  return {
    inicio: inicioMes(fechaTexto),
    fin: finMes(fechaTexto),
    etiqueta: etiquetaMes(fechaTexto),
  };
}

function resumenEstadisticas(ventas, registrosExcluidos = 0) {
  let unidades = 0;
  let importe = 0;
  for (const venta of ventas) {
    unidades += Number(venta.cantidad);
    importe += Number(venta.total_mxn);
  }
  return {
    transacciones_validas: ventas.length,
    unidades,
    importe_mxn: dinero(importe),
    registros_excluidos: registrosExcluidos,
  };
}

function porCategoria(ventas) {
  const acumulado = new Map();
  for (const venta of ventas) {
    const actual = acumulado.get(venta.categoria) || {
      categoria: venta.categoria,
      transacciones: 0,
      unidades: 0,
      importe_mxn: 0,
    };
    actual.transacciones += 1;
    actual.unidades += Number(venta.cantidad);
    actual.importe_mxn += Number(venta.total_mxn);
    acumulado.set(venta.categoria, actual);
  }
  return [...acumulado.values()]
    .map((grupo) => ({ ...grupo, importe_mxn: dinero(grupo.importe_mxn) }))
    .sort((a, b) => a.categoria.localeCompare(b.categoria));
}

function porProducto(ventas) {
  const acumulado = new Map();
  for (const venta of ventas) {
    const actual = acumulado.get(venta.producto_id) || {
      producto_id: venta.producto_id,
      producto: venta.producto,
      categoria: venta.categoria,
      transacciones: 0,
      unidades: 0,
      importe_mxn: 0,
    };
    actual.transacciones += 1;
    actual.unidades += Number(venta.cantidad);
    actual.importe_mxn += Number(venta.total_mxn);
    acumulado.set(venta.producto_id, actual);
  }
  return [...acumulado.values()]
    .map((grupo) => ({ ...grupo, importe_mxn: dinero(grupo.importe_mxn) }))
    .sort((a, b) => b.unidades - a.unidades || a.producto_id.localeCompare(b.producto_id));
}

function porPeriodo(ventas, agrupacion, minFecha, maxFecha) {
  const acumulado = new Map();
  for (const venta of ventas) {
    const periodo = periodoDe(venta.fecha, agrupacion);
    const clave = `${periodo.inicio}|${venta.categoria}`;
    const actual = acumulado.get(clave) || {
      periodo_inicio: periodo.inicio,
      periodo_fin: periodo.fin,
      etiqueta: periodo.etiqueta,
      categoria: venta.categoria,
      transacciones: 0,
      unidades: 0,
      importe_mxn: 0,
    };
    actual.transacciones += 1;
    actual.unidades += Number(venta.cantidad);
    actual.importe_mxn += Number(venta.total_mxn);
    acumulado.set(clave, actual);
  }

  return [...acumulado.values()]
    .map((grupo) => ({
      ...grupo,
      completa:
        Boolean(minFecha) &&
        Boolean(maxFecha) &&
        grupo.periodo_inicio >= minFecha &&
        grupo.periodo_fin <= maxFecha,
      importe_mxn: dinero(grupo.importe_mxn),
    }))
    .sort(
      (a, b) =>
        a.periodo_inicio.localeCompare(b.periodo_inicio) ||
        a.categoria.localeCompare(b.categoria)
    );
}

function periodoSalida(ventas, desde, hasta, agrupacion) {
  const fechas = ventas.map((venta) => venta.fecha);
  return {
    desde: desde || (fechas.length ? [...fechas].sort()[0] : null),
    hasta: hasta || (fechas.length ? [...fechas].sort().at(-1) : null),
    agrupacion,
  };
}

function limitesFechas(ventas) {
  if (ventas.length === 0) {
    return { minFecha: null, maxFecha: null };
  }
  const fechas = ventas.map((venta) => venta.fecha).sort();
  return { minFecha: fechas[0], maxFecha: fechas.at(-1) };
}

function estadisticasCliente(
  ventas,
  { desde = null, hasta = null, agrupacion = 'semana', registrosExcluidos = 0 } = {}
) {
  const { minFecha, maxFecha } = limitesFechas(ventas);
  const periodos = porPeriodo(ventas, agrupacion, minFecha, maxFecha);
  return {
    unidad_cantidad: 'unidades',
    periodo: periodoSalida(ventas, desde, hasta, agrupacion),
    resumen: resumenEstadisticas(ventas, registrosExcluidos),
    por_categoria: porCategoria(ventas),
    por_semana: agrupacion === 'semana' ? periodos : [],
    por_mes: agrupacion === 'mes' ? periodos : [],
    por_producto: porProducto(ventas),
  };
}

function estadisticasAdmin(
  ventas,
  usuarios,
  {
    desde = null,
    hasta = null,
    agrupacion = 'semana',
    registrosExcluidos = 0,
    excluidosPorPropietario = new Map(),
  } = {}
) {
  const ventasPorPropietario = new Map();
  for (const venta of ventas) {
    const lista = ventasPorPropietario.get(venta.propietario_id) || [];
    lista.push(venta);
    ventasPorPropietario.set(venta.propietario_id, lista);
  }

  const clientes = usuarios
    .filter((usuario) => usuario.rol === 'cliente' || ventasPorPropietario.has(usuario.id))
    .map((usuario) => {
      const ventasUsuario = ventasPorPropietario.get(usuario.id) || [];
      const fechas = ventasUsuario.map((venta) => venta.fecha).sort();
      return {
        cliente_id: usuario.id,
        nombre: usuario.nombre,
        correo: usuario.correo,
        rol_actual: usuario.rol,
        activo: usuario.activo === true || Number(usuario.activo) === 1,
        transacciones: ventasUsuario.length,
        unidades: ventasUsuario.reduce((suma, venta) => suma + Number(venta.cantidad), 0),
        importe_mxn: dinero(
          ventasUsuario.reduce((suma, venta) => suma + Number(venta.total_mxn), 0)
        ),
        ultima_venta: fechas.length ? fechas.at(-1) : null,
        registros_excluidos: Number(excluidosPorPropietario.get(usuario.id) || 0),
        por_categoria: porCategoria(ventasUsuario),
      };
    });

  const { minFecha, maxFecha } = limitesFechas(ventas);
  const periodos = porPeriodo(ventas, agrupacion, minFecha, maxFecha);
  const resumen = resumenEstadisticas(ventas, registrosExcluidos);
  return {
    unidad_cantidad: 'unidades',
    periodo: periodoSalida(ventas, desde, hasta, agrupacion),
    resumen: { ...resumen, total_clientes: clientes.length },
    clientes,
    por_categoria: porCategoria(ventas),
    por_semana: agrupacion === 'semana' ? periodos : [],
    por_mes: agrupacion === 'mes' ? periodos : [],
  };
}

module.exports = {
  periodoDe,
  resumenEstadisticas,
  porCategoria,
  porProducto,
  porPeriodo,
  periodoSalida,
  estadisticasCliente,
  estadisticasAdmin,
  inicioSemana,
  finSemana,
  etiquetaSemana,
  etiquetaMes,
  sumarDias,
};

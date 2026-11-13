const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  FORMATO_PRODUCTO,
  FORMATO_FECHA,
  esObjeto,
  textoObligatorio,
  enteroEnRango,
  fechaValida,
  redondear,
  CANTIDAD_MAXIMA,
  PRECIO_MAXIMO_MXN,
  TOTAL_MAXIMO_MXN,
} = require('../validaciones/comunes');

// Patron acordado con Ismael para `id_venta` (ej. D01-066).
const FORMATO_ID_ORIGEN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const TOLERANCIA_TOTAL = 0.01;
const MAXIMO_REGISTROS = 100000;

// El contrato de Ismael declara metadata y ventas como objetos cerrados
// (extra="forbid"): un campo desconocido invalida el conjunto completo.
const CAMPOS_METADATA = new Set([
  'conjunto',
  'perfil_demanda',
  'datos_simulados',
  'moneda',
  'periodo_inicio',
  'periodo_fin',
  'cantidad_registros',
]);
const CAMPOS_VENTA = new Set([
  'id_venta',
  'fecha',
  'producto_id',
  'producto',
  'categoria',
  'precio_unitario_mxn',
  'cantidad',
  'total_mxn',
]);

class ErrorImportacion extends Error {
  constructor(mensaje, detalles = []) {
    super(mensaje);
    this.name = 'ErrorImportacion';
    this.detalles = detalles;
  }
}

function agregar(detalles, archivo, fila, campo, motivo) {
  detalles.push({ archivo, fila, campo, motivo });
}

function hashSha256(contenido) {
  return crypto.createHash('sha256').update(contenido).digest('hex');
}

function tieneDosDecimales(valor) {
  return Math.abs(valor * 100 - Math.round(valor * 100)) < 1e-6;
}

function validarMetadata(metadata, archivo, cantidadVentas, detalles) {
  if (!esObjeto(metadata)) {
    agregar(detalles, archivo, null, 'metadata', 'Falta el objeto metadata o no es un objeto.');
    return null;
  }

  const campos = {};
  for (const clave of Object.keys(metadata)) {
    if (!CAMPOS_METADATA.has(clave)) {
      campos[clave] = 'Campo no reconocido en metadata';
    }
  }
  const conjunto = textoObligatorio(metadata.conjunto, 'conjunto', campos, {
    maximo: 80,
    etiqueta: 'El conjunto',
  });
  const perfil = textoObligatorio(metadata.perfil_demanda, 'perfil_demanda', campos, {
    maximo: 80,
    etiqueta: 'El perfil de demanda',
  });
  const inicio = fechaValida(metadata.periodo_inicio, 'periodo_inicio', campos, {
    permitirFutura: true,
  });
  const fin = fechaValida(metadata.periodo_fin, 'periodo_fin', campos, { permitirFutura: true });
  const cantidad = enteroEnRango(metadata.cantidad_registros, 'cantidad_registros', campos, {
    minimo: 1,
    maximo: MAXIMO_REGISTROS,
    etiqueta: 'La cantidad de registros',
  });

  if (metadata.datos_simulados !== true) {
    campos.datos_simulados = 'El conjunto debe declarar datos_simulados en true';
  }
  if (metadata.moneda !== 'MXN') {
    campos.moneda = 'La moneda debe ser MXN';
  }
  if (inicio && fin && inicio > fin) {
    campos.periodo_fin = 'El periodo de inicio no puede ser posterior al fin';
  }
  if (cantidad !== null && cantidad !== cantidadVentas) {
    campos.cantidad_registros = 'La cantidad declarada no coincide con el número de ventas';
  }

  for (const [campo, motivo] of Object.entries(campos)) {
    agregar(detalles, archivo, null, `metadata.${campo}`, motivo);
  }
  if (Object.keys(campos).length > 0) {
    return null;
  }
  return {
    conjunto,
    perfil_demanda: perfil,
    datos_simulados: true,
    moneda: 'MXN',
    periodo_inicio: inicio,
    periodo_fin: fin,
    cantidad_registros: cantidad,
  };
}

function validarVenta(venta, archivo, fila, metadata, detalles, vistos) {
  if (!esObjeto(venta)) {
    agregar(detalles, archivo, fila, 'venta', 'Cada venta debe ser un objeto.');
    return null;
  }

  const campos = {};
  for (const clave of Object.keys(venta)) {
    if (!CAMPOS_VENTA.has(clave)) {
      campos[clave] = 'Campo no reconocido en la venta';
    }
  }
  let idOrigen = null;
  if (typeof venta.id_venta !== 'string' || !FORMATO_ID_ORIGEN.test(venta.id_venta.trim())) {
    campos.id_venta = 'El identificador de venta no tiene el formato esperado';
  } else {
    idOrigen = venta.id_venta.trim();
    if (vistos.has(idOrigen)) {
      campos.id_venta = 'El identificador de venta está repetido en el archivo';
    } else {
      vistos.add(idOrigen);
    }
  }

  const fecha = fechaValida(venta.fecha, 'fecha', campos);
  if (
    fecha &&
    metadata &&
    (fecha < metadata.periodo_inicio || fecha > metadata.periodo_fin)
  ) {
    campos.fecha = 'La fecha está fuera del periodo declarado';
  }

  let productoId = null;
  if (typeof venta.producto_id !== 'string' || !FORMATO_PRODUCTO.test(venta.producto_id.trim())) {
    campos.producto_id = 'El identificador de producto no tiene el formato del catálogo';
  } else {
    productoId = venta.producto_id.trim();
  }

  const producto = textoObligatorio(venta.producto, 'producto', campos, {
    maximo: 120,
    etiqueta: 'El nombre del producto',
  });
  const categoria = textoObligatorio(venta.categoria, 'categoria', campos, {
    maximo: 60,
    etiqueta: 'La categoría',
  });

  let precio = null;
  const precioNumero =
    typeof venta.precio_unitario_mxn === 'string'
      ? Number(venta.precio_unitario_mxn)
      : venta.precio_unitario_mxn;
  if (
    typeof precioNumero !== 'number' ||
    !Number.isFinite(precioNumero) ||
    precioNumero <= 0 ||
    precioNumero > PRECIO_MAXIMO_MXN
  ) {
    campos.precio_unitario_mxn = 'El precio unitario está fuera del rango permitido';
  } else if (!tieneDosDecimales(precioNumero)) {
    campos.precio_unitario_mxn = 'El precio unitario debe tener como máximo dos decimales';
  } else {
    precio = redondear(precioNumero);
  }

  const cantidad = enteroEnRango(venta.cantidad, 'cantidad', campos, {
    minimo: 1,
    maximo: CANTIDAD_MAXIMA,
    etiqueta: 'La cantidad',
  });

  let total = null;
  const totalNumero =
    typeof venta.total_mxn === 'string' ? Number(venta.total_mxn) : venta.total_mxn;
  if (
    typeof totalNumero !== 'number' ||
    !Number.isFinite(totalNumero) ||
    totalNumero <= 0 ||
    totalNumero > TOTAL_MAXIMO_MXN
  ) {
    campos.total_mxn = 'El total está fuera del rango permitido';
  } else if (!tieneDosDecimales(totalNumero)) {
    campos.total_mxn = 'El total debe tener como máximo dos decimales';
  } else {
    total = redondear(totalNumero);
  }

  if (precio !== null && cantidad !== null && total !== null) {
    if (Math.abs(total - redondear(precio * cantidad)) > TOLERANCIA_TOTAL) {
      campos.total_mxn = 'El total no coincide con precio unitario por cantidad';
    }
  }

  for (const [campo, motivo] of Object.entries(campos)) {
    agregar(detalles, archivo, fila, campo, motivo);
  }
  if (Object.keys(campos).length > 0) {
    return null;
  }
  return {
    id_venta: idOrigen,
    fecha,
    producto_id: productoId,
    producto,
    categoria,
    precio_unitario_mxn: precio,
    cantidad,
    total_mxn: total,
  };
}

function leerArchivoDemo(ruta) {
  const archivo = path.basename(ruta);
  let contenido;
  try {
    contenido = fs.readFileSync(ruta);
  } catch (error) {
    throw new ErrorImportacion(`No se pudo leer ${archivo}.`, [
      { archivo, fila: null, campo: 'archivo', motivo: error.message },
    ]);
  }

  const hash = hashSha256(contenido);
  let datos;
  try {
    datos = JSON.parse(contenido.toString('utf8'));
  } catch {
    throw new ErrorImportacion(`El archivo ${archivo} no contiene JSON válido.`, [
      { archivo, fila: null, campo: 'archivo', motivo: 'JSON inválido.' },
    ]);
  }

  if (!esObjeto(datos)) {
    throw new ErrorImportacion(`El archivo ${archivo} debe contener un objeto JSON.`, [
      { archivo, fila: null, campo: 'archivo', motivo: 'El contenido debe ser un objeto JSON.' },
    ]);
  }

  const detalles = [];
  const ventasCrudas = Array.isArray(datos.ventas) ? datos.ventas : [];
  if (!Array.isArray(datos.ventas)) {
    agregar(detalles, archivo, null, 'ventas', 'Falta la lista ventas o no es una lista.');
  }

  const metadata = validarMetadata(datos.metadata, archivo, ventasCrudas.length, detalles);
  const vistos = new Set();
  const ventas = [];
  for (let indice = 0; indice < ventasCrudas.length; indice += 1) {
    const venta = validarVenta(
      ventasCrudas[indice],
      archivo,
      indice + 1,
      metadata,
      detalles,
      vistos
    );
    if (venta) {
      ventas.push(venta);
    }
  }

  if (detalles.length > 0) {
    throw new ErrorImportacion(`El archivo ${archivo} no es válido.`, detalles);
  }
  return { archivo, ruta, hash_sha256: hash, metadata, ventas };
}

function cargarDirectorioDemo(directorio) {
  let entradas;
  try {
    entradas = fs.readdirSync(directorio);
  } catch (error) {
    throw new ErrorImportacion(`No se pudo leer el directorio ${directorio}.`, [
      { archivo: directorio, fila: null, campo: 'directorio', motivo: error.message },
    ]);
  }

  const rutas = entradas
    .filter((archivo) => archivo.toLowerCase().endsWith('.json'))
    .sort()
    .map((archivo) => path.join(directorio, archivo));

  if (rutas.length === 0) {
    throw new ErrorImportacion('No hay archivos JSON en el directorio de demostración.', [
      {
        archivo: directorio,
        fila: null,
        campo: 'directorio',
        motivo: 'No se encontraron archivos JSON.',
      },
    ]);
  }

  const archivos = rutas.map((ruta) => leerArchivoDemo(ruta));
  const detalles = [];
  const conjuntos = new Set();
  const hashes = new Map();
  const catalogo = new Map();

  for (const archivo of archivos) {
    const { conjunto } = archivo.metadata;
    if (conjuntos.has(conjunto)) {
      agregar(
        detalles,
        archivo.archivo,
        null,
        'metadata.conjunto',
        'El conjunto está repetido entre los archivos del directorio.'
      );
    }
    conjuntos.add(conjunto);

    if (hashes.has(archivo.hash_sha256)) {
      agregar(
        detalles,
        archivo.archivo,
        null,
        'archivo',
        `El mismo contenido ya aparece en ${hashes.get(archivo.hash_sha256)}.`
      );
    }
    hashes.set(archivo.hash_sha256, archivo.archivo);

    for (const venta of archivo.ventas) {
      const anterior = catalogo.get(venta.producto_id);
      if (
        anterior &&
        (anterior.producto !== venta.producto ||
          anterior.categoria !== venta.categoria ||
          anterior.precio_unitario_mxn !== venta.precio_unitario_mxn)
      ) {
        agregar(
          detalles,
          archivo.archivo,
          null,
          'producto_id',
          `El producto ${venta.producto_id} tiene nombre, categoría o precio distintos entre archivos.`
        );
      } else {
        catalogo.set(venta.producto_id, {
          producto: venta.producto,
          categoria: venta.categoria,
          precio_unitario_mxn: venta.precio_unitario_mxn,
        });
      }
    }
  }

  if (detalles.length > 0) {
    throw new ErrorImportacion('Los conjuntos de demostración no son válidos.', detalles);
  }
  return { archivos, catalogo };
}

function fechaDeHoy() {
  const ahora = new Date();
  return new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

module.exports = {
  ErrorImportacion,
  FORMATO_ID_ORIGEN,
  hashSha256,
  leerArchivoDemo,
  cargarDirectorioDemo,
  validarMetadata,
  validarVenta,
  fechaDeHoy,
  FORMATO_FECHA,
};

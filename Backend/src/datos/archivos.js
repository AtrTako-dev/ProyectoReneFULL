const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { configuracion } = require('../config/entornoDatos');
const { ErrorValidacionDatos } = require('./errores');
const { hoyIso } = require('./fechas');
const {
  esObjeto,
  validarMetadataDemo,
  validarVentaImportada,
} = require('./validacion');

function leerTextoUtf8(buffer, archivo) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    throw new ErrorValidacionDatos([
      { archivo, campo: 'archivo', mensaje: 'El archivo no está codificado en UTF-8 válido.' },
    ]);
  }
}

function leerArchivosDemo({
  directorio = configuracion.rutas.datosDemo,
  hoy = hoyIso(),
  exigirCinco = true,
  exigirCien = true,
} = {}) {
  if (!fs.existsSync(directorio)) {
    throw new ErrorValidacionDatos([
      {
        archivo: null,
        campo: 'directorio',
        mensaje: `No existe el directorio de datos de demostración: ${directorio}`,
      },
    ]);
  }

  const nombres = fs
    .readdirSync(directorio)
    .filter((nombre) => nombre.toLowerCase().endsWith('.json'))
    .sort();

  if (nombres.length === 0) {
    throw new ErrorValidacionDatos([
      {
        archivo: null,
        campo: 'directorio',
        mensaje: 'No hay archivos JSON de demostración para cargar.',
      },
    ]);
  }
  if (exigirCinco && nombres.length !== 5) {
    throw new ErrorValidacionDatos([
      {
        archivo: null,
        campo: 'archivos',
        mensaje: `Se esperaban exactamente 5 archivos de demostración y se encontraron ${nombres.length}.`,
      },
    ]);
  }

  const errores = [];
  const archivos = [];
  const idsOrigen = new Map();
  const conjuntos = new Map();
  const hashes = new Map();
  const catalogo = new Map();

  for (const nombre of nombres) {
    const ruta = path.join(directorio, nombre);
    let contenido;
    try {
      contenido = fs.readFileSync(ruta);
    } catch (error) {
      errores.push({
        archivo: nombre,
        campo: 'archivo',
        mensaje: `No fue posible leer el archivo: ${error.message}`,
      });
      continue;
    }

    const hashSha256 = crypto.createHash('sha256').update(contenido).digest('hex');
    if (hashes.has(hashSha256)) {
      errores.push({
        archivo: nombre,
        campo: 'archivo',
        mensaje: `El archivo es idéntico a ${hashes.get(hashSha256)}; no se permite duplicar el conjunto.`,
      });
    } else {
      hashes.set(hashSha256, nombre);
    }

    let documento;
    try {
      documento = JSON.parse(leerTextoUtf8(contenido, nombre));
    } catch (error) {
      if (error instanceof ErrorValidacionDatos) {
        errores.push(...error.errores);
      } else {
        errores.push({
          archivo: nombre,
          campo: 'json',
          mensaje: `El archivo no contiene JSON válido: ${error.message}`,
        });
      }
      continue;
    }

    if (!esObjeto(documento) || !Array.isArray(documento.ventas)) {
      errores.push({
        archivo: nombre,
        campo: 'ventas',
        mensaje: 'El documento debe ser un objeto con un arreglo "ventas".',
      });
      continue;
    }

    const metadata = documento.metadata;
    errores.push(
      ...validarMetadataDemo(metadata, { archivo: nombre, cantidadFilas: documento.ventas.length })
    );

    if (exigirCien && documento.ventas.length !== 100) {
      errores.push({
        archivo: nombre,
        campo: 'ventas',
        mensaje: `Cada conjunto de demostración debe tener 100 ventas; este tiene ${documento.ventas.length}.`,
      });
    }

    if (esObjeto(metadata) && typeof metadata.conjunto === 'string') {
      if (conjuntos.has(metadata.conjunto)) {
        errores.push({
          archivo: nombre,
          campo: 'conjunto',
          mensaje: `El conjunto "${metadata.conjunto}" ya existe en ${conjuntos.get(metadata.conjunto)}.`,
        });
      } else {
        conjuntos.set(metadata.conjunto, nombre);
      }
    }

    const ventas = [];
    documento.ventas.forEach((fila, indice) => {
      const resultado = validarVentaImportada(fila, {
        archivo: nombre,
        indice: indice + 1,
        metadata,
        hoy,
      });
      errores.push(...resultado.problemas);
      if (!resultado.datos) return;

      const venta = resultado.datos;
      if (idsOrigen.has(venta.idOrigen)) {
        errores.push({
          archivo: nombre,
          fila: indice + 1,
          campo: 'id_venta',
          mensaje: `id_venta "${venta.idOrigen}" está repetido en ${idsOrigen.get(venta.idOrigen)}.`,
        });
      } else {
        idsOrigen.set(venta.idOrigen, nombre);
      }
      ventas.push(venta);

      const existente = catalogo.get(venta.productoId);
      if (!existente) {
        catalogo.set(venta.productoId, {
          productoId: venta.productoId,
          producto: venta.producto,
          categoria: venta.categoria,
          precioCentavos: venta.precioCentavos,
          fechaPrecio: venta.fecha,
          archivo: nombre,
        });
      } else {
        if (existente.producto !== venta.producto || existente.categoria !== venta.categoria) {
          errores.push({
            archivo: nombre,
            fila: indice + 1,
            campo: 'producto_id',
            mensaje:
              `El producto ${venta.productoId} cambia de nombre o categoría respecto a ` +
              `${existente.archivo}; el catálogo debe ser consistente.`,
          });
        }
        if (venta.fecha > existente.fechaPrecio) {
          existente.precioCentavos = venta.precioCentavos;
          existente.fechaPrecio = venta.fecha;
          existente.archivo = nombre;
        } else if (venta.fecha === existente.fechaPrecio) {
          if (venta.precioCentavos !== existente.precioCentavos) {
            errores.push({
              archivo: nombre,
              fila: indice + 1,
              campo: 'precio_unitario_mxn',
              mensaje:
                `El producto ${venta.productoId} tiene dos precios distintos en la misma fecha ` +
                `${venta.fecha}; no se puede determinar el precio actual del catálogo.`,
            });
          }
        }
      }
    });

    archivos.push({
      nombre,
      ruta,
      hashSha256,
      metadata,
      ventas,
      cantidadFilas: documento.ventas.length,
    });
  }

  if (errores.length > 0) {
    throw new ErrorValidacionDatos(errores);
  }

  return { archivos, catalogo };
}

module.exports = { leerArchivosDemo };

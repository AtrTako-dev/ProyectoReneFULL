const { configuracion } = require('../config/entornoDatos');
const { conTransaccion } = require('../db/mysql');
const { leerArchivosDemo } = require('./archivos');
const { desdeCentavos } = require('./dinero');
const {
  ErrorConflictoImportacion,
  ErrorOperacionNoPermitida,
} = require('./errores');
const { emailValido, normalizarEmail } = require('./validacion');

function marcadores(cantidad) {
  return Array.from({ length: cantidad }, () => '?').join(', ');
}

async function cargarDemo({
  directorio = configuracion.rutas.datosDemo,
  emailDemo = configuracion.demo.email,
  importadoPorEmail = configuracion.importacion.importadoPorEmail,
  hoy,
  exigirCinco = true,
  exigirCien = true,
} = {}) {
  const email = normalizarEmail(emailDemo);
  if (!emailValido(email)) {
    throw new ErrorOperacionNoPermitida(
      'Configura DEMO_EMAIL con un correo válido de una cuenta cliente existente.'
    );
  }

  const { archivos, catalogo } = leerArchivosDemo({
    directorio,
    hoy,
    exigirCinco,
    exigirCien,
  });

  return conTransaccion(async (conexion) => {
    const [filasUsuario] = await conexion.execute(
      'SELECT id, nombre, email, rol, activo FROM usuarios WHERE email = ? FOR UPDATE',
      [email]
    );
    if (filasUsuario.length === 0) {
      throw new ErrorOperacionNoPermitida(
        `No existe la cuenta cliente de demostración ${email}. Ejecuta primero "npm run demo:cuenta".`
      );
    }
    const propietario = filasUsuario[0];
    if (Number(propietario.activo) !== 1) {
      throw new ErrorOperacionNoPermitida(`La cuenta ${email} está inactiva.`);
    }
    if (propietario.rol !== 'cliente') {
      throw new ErrorOperacionNoPermitida(
        `La cuenta ${email} debe tener rol cliente para recibir los datos de demostración.`
      );
    }

    let importadoPorId = null;
    const emailImportador = normalizarEmail(importadoPorEmail);
    if (emailImportador) {
      if (!emailValido(emailImportador)) {
        throw new ErrorOperacionNoPermitida('IMPORTADO_POR_EMAIL no es un correo válido.');
      }
      const [filasImportador] = await conexion.execute(
        'SELECT id FROM usuarios WHERE email = ?',
        [emailImportador]
      );
      if (filasImportador.length === 0) {
        throw new ErrorOperacionNoPermitida(
          `No existe el usuario importador ${emailImportador}.`
        );
      }
      importadoPorId = filasImportador[0].id;
    }

    const conjuntos = archivos.map((archivo) => archivo.metadata.conjunto);
    const [existentes] = await conexion.execute(
      `SELECT id, conjunto, hash_sha256, cantidad_registros, propietario_id
         FROM importaciones
        WHERE conjunto IN (${marcadores(conjuntos.length)})
        FOR UPDATE`,
      conjuntos
    );
    const existentesPorConjunto = new Map(existentes.map((fila) => [fila.conjunto, fila]));

    for (const archivo of archivos) {
      const existente = existentesPorConjunto.get(archivo.metadata.conjunto);
      if (!existente) continue;
      if (Number(existente.propietario_id) !== Number(propietario.id)) {
        throw new ErrorConflictoImportacion(
          `El conjunto ${archivo.metadata.conjunto} ya fue importado para otro usuario.`,
          {
            conjunto: archivo.metadata.conjunto,
            propietario_existente: existente.propietario_id,
          }
        );
      }
      if (existente.hash_sha256 !== archivo.hashSha256) {
        throw new ErrorConflictoImportacion(
          `El conjunto ${archivo.metadata.conjunto} ya existe con un contenido diferente.`,
          {
            conjunto: archivo.metadata.conjunto,
            hash_importado: existente.hash_sha256,
            hash_nuevo: archivo.hashSha256,
          }
        );
      }
    }

    const hashes = archivos.map((archivo) => archivo.hashSha256);
    const [mismoHash] = await conexion.execute(
      `SELECT id, conjunto, hash_sha256
         FROM importaciones
        WHERE hash_sha256 IN (${marcadores(hashes.length)})
          AND conjunto NOT IN (${marcadores(conjuntos.length)})
        FOR UPDATE`,
      [...hashes, ...conjuntos]
    );
    if (mismoHash.length > 0) {
      throw new ErrorConflictoImportacion(
        'Uno de los archivos ya fue importado bajo otro conjunto; el hash de contenido debe ser único.',
        { conjunto_existente: mismoHash[0].conjunto }
      );
    }

    for (const producto of catalogo.values()) {
      const [filasProducto] = await conexion.execute(
        `SELECT producto_id, producto, categoria, precio_unitario_mxn, activo
           FROM productos
          WHERE producto_id = ?
          FOR UPDATE`,
        [producto.productoId]
      );
      if (filasProducto.length === 0) {
        await conexion.execute(
          `INSERT INTO productos
             (producto_id, producto, categoria, precio_unitario_mxn, activo)
           VALUES (?, ?, ?, ?, 1)`,
          [
            producto.productoId,
            producto.producto,
            producto.categoria,
            desdeCentavos(producto.precioCentavos),
          ]
        );
        continue;
      }

      const actual = filasProducto[0];
      if (Number(actual.activo) !== 1) {
        throw new ErrorConflictoImportacion(
          `El producto ${producto.productoId} está inactivo en el catálogo; no se importan ventas nuevas.`
        );
      }
      if (actual.producto !== producto.producto || actual.categoria !== producto.categoria) {
        throw new ErrorConflictoImportacion(
          `El producto ${producto.productoId} no coincide con el catálogo existente.`,
          {
            producto_id: producto.productoId,
            catalogo: {
              producto: actual.producto,
              categoria: actual.categoria,
            },
            archivo: {
              producto: producto.producto,
              categoria: producto.categoria,
            },
          }
        );
      }
      // El precio del catálogo es el vigente. El precio de cada venta se conserva
      // en ventas.precio_unitario_mxn y no se sobreescribe con el actual.
    }

    const resumenArchivos = [];
    let ventasInsertadas = 0;
    let ventasExistentes = 0;
    let archivosImportados = 0;
    let archivosOmitidos = 0;

    for (const archivo of archivos) {
      const existente = existentesPorConjunto.get(archivo.metadata.conjunto);
      if (existente) {
        const cantidad = Number(existente.cantidad_registros);
        ventasExistentes += cantidad;
        archivosOmitidos += 1;
        resumenArchivos.push({
          archivo: archivo.nombre,
          conjunto: archivo.metadata.conjunto,
          estado: 'ya_importado',
          ventas_insertadas: 0,
          ventas_existentes: cantidad,
          hash_sha256: archivo.hashSha256,
        });
        continue;
      }

      const [resultadoImportacion] = await conexion.execute(
        `INSERT INTO importaciones
           (conjunto, archivo, hash_sha256, perfil_demanda, fuente, es_demostracion,
            moneda, periodo_inicio, periodo_fin, cantidad_registros, propietario_id, importado_por)
         VALUES (?, ?, ?, ?, 'datos_simulados', 1, 'MXN', ?, ?, ?, ?, ?)`,
        [
          archivo.metadata.conjunto,
          archivo.nombre,
          archivo.hashSha256,
          archivo.metadata.perfil_demanda,
          archivo.metadata.periodo_inicio,
          archivo.metadata.periodo_fin,
          archivo.ventas.length,
          propietario.id,
          importadoPorId,
        ]
      );

      const valores = archivo.ventas.map((venta) => [
        resultadoImportacion.insertId,
        venta.idOrigen,
        propietario.id,
        venta.fecha,
        venta.productoId,
        venta.producto,
        venta.categoria,
        desdeCentavos(venta.precioCentavos),
        venta.cantidad,
        desdeCentavos(venta.totalCentavos),
      ]);

      await conexion.query(
        `INSERT INTO ventas
           (importacion_id, id_origen, usuario_id, fecha, producto_id, producto,
            categoria, precio_unitario_mxn, cantidad, total_mxn)
         VALUES ?`,
        [valores]
      );

      ventasInsertadas += valores.length;
      archivosImportados += 1;
      resumenArchivos.push({
        archivo: archivo.nombre,
        conjunto: archivo.metadata.conjunto,
        estado: 'importado',
        ventas_insertadas: valores.length,
        ventas_existentes: 0,
        hash_sha256: archivo.hashSha256,
      });
    }

    return {
      propietario: {
        id: Number(propietario.id),
        email: propietario.email,
      },
      archivos: resumenArchivos,
      totales: {
        archivos: archivos.length,
        archivos_importados: archivosImportados,
        archivos_ya_importados: archivosOmitidos,
        ventas_insertadas: ventasInsertadas,
        ventas_existentes: ventasExistentes,
        productos_catalogo: catalogo.size,
      },
    };
  });
}

module.exports = { cargarDemo };

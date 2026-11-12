const path = require('node:path');
const { configuracion } = require('../src/config/entorno');
const usuarioModelo = require('../src/modelos/usuarioModelo');
const categoriaModelo = require('../src/modelos/categoriaModelo');
const importacionModelo = require('../src/modelos/importacionModelo');
const { cargarDirectorioDemo, ErrorImportacion } = require('../src/servicios/importacionDemo');
const { obtenerPool, cerrarPool } = require('../src/db/conexion');

const DIRECTORIO_PREDETERMINADO = path.join(__dirname, '..', 'data', 'demo');

function imprimirDetalles(detalles) {
  for (const detalle of detalles) {
    const fila = detalle.fila === null || detalle.fila === undefined ? '-' : detalle.fila;
    console.error(
      `  archivo=${detalle.archivo} fila=${fila} campo=${detalle.campo}: ${detalle.motivo}`
    );
  }
}

function estaActivo(usuario) {
  return Boolean(usuario) && (usuario.activo === true || Number(usuario.activo) === 1);
}

async function buscarImportador(conexion) {
  const correo = (configuracion.admin.email || '').trim().toLowerCase();
  if (!correo) {
    return null;
  }
  const importador = await usuarioModelo.buscarPorCorreo(correo, conexion);
  if (!importador || importador.rol !== 'administrador' || !estaActivo(importador)) {
    throw new ErrorImportacion(
      'La cuenta indicada en ADMIN_EMAIL no existe, no está activa o no es administradora.'
    );
  }
  return importador;
}

async function sembrarCatalogo(catalogo, conexion) {
  const categorias = new Map();
  const categoriasOrdenadas = [...new Set([...catalogo.values()].map((valor) => valor.categoria))].sort();
  for (const nombre of categoriasOrdenadas) {
    const categoria = await categoriaModelo.asegurar(nombre, conexion);
    categorias.set(nombre, categoria.id);
  }

  for (const productoId of [...catalogo.keys()].sort()) {
    const { producto, categoria, precio_unitario_mxn: precio } = catalogo.get(productoId);
    await conexion.execute(
      `INSERT INTO productos (id, nombre, categoria_id, precio_actual_mxn, activo)
       VALUES (?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE
         nombre = VALUES(nombre),
         categoria_id = VALUES(categoria_id),
         precio_actual_mxn = VALUES(precio_actual_mxn),
         activo = 1,
         actualizado_en = CURRENT_TIMESTAMP`,
      [productoId, producto, categorias.get(categoria), precio]
    );
  }
  return { categorias: categorias.size, productos: catalogo.size };
}

async function insertarVentas(archivo, importacionId, propietarioId, conexion) {
  const columnas =
    '(importacion_id, id_origen, propietario_id, fecha, producto_id, ' +
    'precio_unitario_mxn, cantidad, total_mxn)';
  const filas = archivo.ventas.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
  const parametros = [];
  for (const venta of archivo.ventas) {
    parametros.push(
      importacionId,
      venta.id_venta,
      propietarioId,
      venta.fecha,
      venta.producto_id,
      venta.precio_unitario_mxn,
      venta.cantidad,
      venta.total_mxn
    );
  }
  await conexion.execute(`INSERT INTO ventas ${columnas} VALUES ${filas}`, parametros);
}

async function principal() {
  const correoPropietario = (configuracion.demo.email || '').trim().toLowerCase();
  if (!correoPropietario) {
    throw new ErrorImportacion(
      'Configura DEMO_EMAIL en el archivo .env con una cuenta cliente existente.'
    );
  }

  const directorio = process.env.DEMO_DIRECTORIO
    ? path.resolve(process.env.DEMO_DIRECTORIO)
    : DIRECTORIO_PREDETERMINADO;

  // La validación completa ocurre antes de abrir la transacción: un conjunto
  // inválido no debe modificar el catálogo ni las importaciones.
  const { archivos, catalogo } = cargarDirectorioDemo(directorio);

  const conexion = await obtenerPool().getConnection();
  try {
    await conexion.beginTransaction();

    const propietario = await usuarioModelo.buscarPorCorreo(correoPropietario, conexion);
    if (!propietario) {
      throw new ErrorImportacion(
        'La cuenta indicada en DEMO_EMAIL no existe. Regístrala antes de cargar los datos.'
      );
    }
    if (!estaActivo(propietario) || propietario.rol !== 'cliente') {
      throw new ErrorImportacion(
        'La cuenta indicada en DEMO_EMAIL debe ser un cliente activo.'
      );
    }

    const importador = await buscarImportador(conexion);
    const yaImportados = [];

    for (const archivo of archivos) {
      const { conjunto } = archivo.metadata;
      const existente = await importacionModelo.buscarPorConjunto(conjunto, conexion);
      if (existente) {
        if (existente.hash_sha256 === archivo.hash_sha256) {
          yaImportados.push({ archivo, importacion: existente });
          continue;
        }
        throw new ErrorImportacion(
          `El conjunto ${conjunto} ya existe con un contenido distinto.`
        );
      }
      const mismoHash = await importacionModelo.buscarPorHash(archivo.hash_sha256, conexion);
      if (mismoHash) {
        throw new ErrorImportacion(
          `El mismo contenido ya fue importado como ${mismoHash.conjunto}.`
        );
      }
    }

    const sembrado = await sembrarCatalogo(catalogo, conexion);

    for (const archivo of archivos) {
      if (yaImportados.some(({ archivo: importado }) => importado.archivo === archivo.archivo)) {
        continue;
      }
      const importacionId = await importacionModelo.crear(
        {
          conjunto: archivo.metadata.conjunto,
          archivo: archivo.archivo,
          hashSha256: archivo.hash_sha256,
          perfilDemanda: archivo.metadata.perfil_demanda,
          fuente: 'datos_simulados',
          esDemostracion: true,
          moneda: archivo.metadata.moneda,
          periodoInicio: archivo.metadata.periodo_inicio,
          periodoFin: archivo.metadata.periodo_fin,
          cantidadRegistros: archivo.metadata.cantidad_registros,
          propietarioId: propietario.id,
          importadoPor: importador ? importador.id : null,
        },
        conexion
      );
      await insertarVentas(archivo, importacionId, propietario.id, conexion);
      console.log(
        `${archivo.archivo}: importado, ventas insertadas=${archivo.ventas.length}, importacion=${importacionId}`
      );
    }

    await conexion.commit();

    for (const { archivo, importacion } of yaImportados) {
      console.log(
        `${archivo.archivo}: ya_importado, ventas existentes=${importacion.cantidad_registros}, importacion=${importacion.id}`
      );
    }
    console.log(
      `Carga terminada. Catálogo: ${sembrado.categorias} categorías, ${sembrado.productos} productos. ` +
        `Propietario: ${propietario.correo}.`
    );
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release();
  }
}

if (require.main === module) {
  principal()
    .catch((error) => {
      console.error(`No se pudieron cargar los datos de demostración: ${error.message}`);
      if (error instanceof ErrorImportacion && error.detalles.length > 0) {
        imprimirDetalles(error.detalles);
      }
      process.exitCode = 1;
    })
    .finally(cerrarPool);
}

module.exports = {
  principal,
  sembrarCatalogo,
  insertarVentas,
  imprimirDetalles,
};

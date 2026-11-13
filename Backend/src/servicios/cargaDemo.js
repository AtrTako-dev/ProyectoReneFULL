const { configuracion } = require('../config/entorno');
const usuarioModelo = require('../modelos/usuarioModelo');
const categoriaModelo = require('../modelos/categoriaModelo');
const importacionModelo = require('../modelos/importacionModelo');
const { obtenerPool } = require('../db/conexion');
const { cargarDirectorioDemo, ErrorImportacion } = require('./importacionDemo');

function estaActivo(usuario) {
  return Boolean(usuario) && (usuario.activo === true || Number(usuario.activo) === 1);
}

function normalizarCorreo(correo) {
  return typeof correo === 'string' ? correo.trim().toLowerCase() : '';
}

async function buscarPropietario(correo, conexion) {
  const correoNormalizado = normalizarCorreo(correo);
  if (!correoNormalizado) {
    throw new ErrorImportacion(
      'Configura DEMO_EMAIL en el archivo .env con una cuenta cliente existente.'
    );
  }
  const propietario = await usuarioModelo.buscarPorCorreo(correoNormalizado, conexion);
  if (!propietario) {
    throw new ErrorImportacion(
      'La cuenta indicada en DEMO_EMAIL no existe. Regístrala antes de cargar los datos.'
    );
  }
  if (!estaActivo(propietario) || propietario.rol !== 'cliente') {
    throw new ErrorImportacion('La cuenta indicada en DEMO_EMAIL debe ser un cliente activo.');
  }
  return propietario;
}

async function buscarImportador(correo, conexion) {
  const correoNormalizado = normalizarCorreo(correo);
  if (!correoNormalizado) {
    return null;
  }
  const importador = await usuarioModelo.buscarPorCorreo(correoNormalizado, conexion);
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
    const [filas] = await conexion.execute(
      `SELECT id, nombre, categoria_id, precio_actual_mxn, activo
         FROM productos
        WHERE id = ?
        LIMIT 1`,
      [productoId]
    );
    const existente = filas[0];
    if (!existente) {
      await conexion.execute(
        `INSERT INTO productos (id, nombre, categoria_id, precio_actual_mxn, activo)
         VALUES (?, ?, ?, ?, 1)`,
        [productoId, producto, categorias.get(categoria), precio]
      );
      continue;
    }

    // El catálogo existente es inmutable para esta carga: solo se crea lo que
    // falta. Cualquier diferencia se reporta y la transacción completa revierte.
    const discrepancias = [];
    if (existente.nombre !== producto) {
      discrepancias.push('nombre');
    }
    if (Number(existente.categoria_id) !== Number(categorias.get(categoria))) {
      discrepancias.push('categoría');
    }
    if (
      Math.round(Number(existente.precio_actual_mxn) * 100) !==
      Math.round(precio * 100)
    ) {
      discrepancias.push('precio vigente');
    }
    if (Number(existente.activo) !== 1) {
      discrepancias.push('estado activo (está inactivo y no se reactiva)');
    }
    if (discrepancias.length > 0) {
      throw new ErrorImportacion(
        `El producto ${productoId} ya existe y no coincide con la demo en: ` +
          `${discrepancias.join(', ')}. La carga no sobrescribe el catálogo existente.`,
        [
          {
            archivo: null,
            fila: null,
            campo: `producto.${productoId}`,
            motivo: discrepancias.join(', '),
          },
        ]
      );
    }
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

async function cargarDemo({
  directorio = configuracion.demo.directorio,
  correoPropietario = configuracion.demo.email,
  correoImportador = configuracion.admin.email,
} = {}) {
  // La validación completa ocurre antes de abrir la transacción: un conjunto
  // inválido no debe modificar el catálogo ni las importaciones.
  const { archivos, catalogo } = cargarDirectorioDemo(directorio);

  const conexion = await obtenerPool().getConnection();
  try {
    await conexion.beginTransaction();

    const propietario = await buscarPropietario(correoPropietario, conexion);
    const importador = await buscarImportador(correoImportador, conexion);
    const yaImportados = [];

    for (const archivo of archivos) {
      const { conjunto } = archivo.metadata;
      const existente = await importacionModelo.buscarPorConjunto(conjunto, conexion);
      if (existente) {
        if (existente.hash_sha256 !== archivo.hash_sha256) {
          throw new ErrorImportacion(
            `El conjunto ${conjunto} ya existe con un contenido distinto.`
          );
        }
        if (String(existente.propietario_id) !== String(propietario.id)) {
          throw new ErrorImportacion(
            `El conjunto ${conjunto} ya fue importado por otro propietario; ` +
              'no se reasignan ventas ni se modifica la importación existente.'
          );
        }
        yaImportados.push({ archivo, importacion: existente });
        continue;
      }
      const mismoHash = await importacionModelo.buscarPorHash(archivo.hash_sha256, conexion);
      if (mismoHash) {
        throw new ErrorImportacion(
          `El mismo contenido ya fue importado como ${mismoHash.conjunto}.`
        );
      }
    }

    const sembrado = await sembrarCatalogo(catalogo, conexion);
    const importados = [];
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
      importados.push({
        conjunto: archivo.metadata.conjunto,
        archivo: archivo.archivo,
        importacion_id: Number(importacionId),
        ventas: archivo.ventas.length,
      });
    }

    await conexion.commit();

    return {
      propietario: { id: propietario.id, correo: propietario.correo },
      importador: importador ? { id: importador.id, correo: importador.correo } : null,
      catalogo: sembrado,
      importados,
      omitidos: yaImportados.map(({ archivo, importacion }) => ({
        conjunto: archivo.metadata.conjunto,
        archivo: archivo.archivo,
        importacion_id: Number(importacion.id),
        ventas: Number(importacion.cantidad_registros),
      })),
      ventas_insertadas: importados.reduce((total, item) => total + item.ventas, 0),
      ventas_omitidas: yaImportados.reduce(
        (total, item) => total + Number(item.importacion.cantidad_registros),
        0
      ),
    };
  } catch (error) {
    try {
      await conexion.rollback();
    } catch {
      // Se conserva el error original; un fallo de rollback no debe ocultarlo.
    }
    if (error && (error.code === 'ER_DUP_ENTRY' || error.code === 'ER_LOCK_DEADLOCK')) {
      throw new ErrorImportacion(
        'Otra carga concurrente registró el mismo conjunto o contenido. ' +
          'No se duplicaron datos; consulte la tabla importaciones y reintente.'
      );
    }
    throw error;
  } finally {
    conexion.release();
  }
}

module.exports = {
  cargarDemo,
  sembrarCatalogo,
  insertarVentas,
  buscarPropietario,
  buscarImportador,
};

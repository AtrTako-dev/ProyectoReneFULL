const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  cargarDirectorioDemo,
  leerArchivoDemo,
  hashSha256,
  ErrorImportacion,
} = require('../src/servicios/importacionDemo');

const DIRECTORIO_DEMO = path.join(__dirname, '..', 'data', 'demo');

function metadata(extra = {}) {
  return {
    conjunto: 'prueba_demo',
    perfil_demanda: 'balanceado',
    datos_simulados: true,
    moneda: 'MXN',
    periodo_inicio: '2026-01-01',
    periodo_fin: '2026-01-31',
    cantidad_registros: 1,
    ...extra,
  };
}

function venta(extra = {}) {
  return {
    id_venta: 'D01-001',
    fecha: '2026-01-15',
    producto_id: 'B003',
    producto: 'Jugo de naranja 1 L',
    categoria: 'Bebidas',
    precio_unitario_mxn: 31,
    cantidad: 2,
    total_mxn: 62,
    ...extra,
  };
}

function enDirectorioTemporal(contenido) {
  const directorio = fs.mkdtempSync(path.join(os.tmpdir(), 'renefull-demo-'));
  fs.writeFileSync(path.join(directorio, 'demo.json'), JSON.stringify(contenido), 'utf8');
  return directorio;
}

test('los cinco conjuntos reales se validan y comparten catálogo', () => {
  const { archivos, catalogo } = cargarDirectorioDemo(DIRECTORIO_DEMO);

  assert.equal(archivos.length, 5);
  assert.equal(
    archivos.reduce((total, archivo) => total + archivo.ventas.length, 0),
    500
  );
  assert.equal(catalogo.size, 41);
  assert.equal(new Set(archivos.map((archivo) => archivo.metadata.conjunto)).size, 5);

  for (const archivo of archivos) {
    assert.match(archivo.hash_sha256, /^[a-f0-9]{64}$/);
    assert.equal(archivo.metadata.moneda, 'MXN');
    assert.equal(archivo.metadata.datos_simulados, true);
    assert.equal(archivo.ventas.length, archivo.metadata.cantidad_registros);
    for (const ventaImportada of archivo.ventas) {
      assert.equal(typeof ventaImportada.id_venta, 'string');
      assert.equal(typeof ventaImportada.producto_id, 'string');
    }
  }
});

test('el hash SHA-256 corresponde a los bytes del archivo', () => {
  const archivo = path.join(DIRECTORIO_DEMO, 'ventas_sucursal_demo_01.json');
  const bytes = fs.readFileSync(archivo);
  assert.equal(leerArchivoDemo(archivo).hash_sha256, hashSha256(bytes));
});

test('rechaza metadata cuya cantidad no coincide con las ventas', () => {
  const directorio = enDirectorioTemporal({
    metadata: metadata({ cantidad_registros: 2 }),
    ventas: [venta()],
  });

  try {
    assert.throws(
      () => cargarDirectorioDemo(directorio),
      (error) =>
        error instanceof ErrorImportacion &&
        error.detalles.some(
          (detalle) =>
            detalle.campo === 'metadata.cantidad_registros' &&
            /no coincide/.test(detalle.motivo)
        )
    );
  } finally {
    fs.rmSync(directorio, { recursive: true, force: true });
  }
});

test('rechaza un identificador de venta repetido dentro del archivo', () => {
  const directorio = enDirectorioTemporal({
    metadata: metadata({ cantidad_registros: 2 }),
    ventas: [venta(), venta()],
  });

  try {
    assert.throws(
      () => cargarDirectorioDemo(directorio),
      (error) =>
        error instanceof ErrorImportacion &&
        error.detalles.some(
          (detalle) => detalle.campo === 'id_venta' && /repetido/.test(detalle.motivo)
        )
    );
  } finally {
    fs.rmSync(directorio, { recursive: true, force: true });
  }
});

test('rechaza un total incoherente y una fecha fuera del periodo', () => {
  const directorio = enDirectorioTemporal({
    metadata: metadata(),
    ventas: [venta({ total_mxn: 60, fecha: '2026-02-15' })],
  });

  try {
    assert.throws(
      () => cargarDirectorioDemo(directorio),
      (error) =>
        error instanceof ErrorImportacion &&
        error.detalles.some((detalle) => detalle.campo === 'total_mxn') &&
        error.detalles.some((detalle) => detalle.campo === 'fecha')
    );
  } finally {
    fs.rmSync(directorio, { recursive: true, force: true });
  }
});

test('rechaza campos desconocidos en metadata y en cada venta', () => {
  const directorio = enDirectorioTemporal({
    metadata: metadata({ campo_extra: 'no permitido' }),
    ventas: [venta({ descuento: 5 })],
  });

  try {
    assert.throws(
      () => cargarDirectorioDemo(directorio),
      (error) =>
        error instanceof ErrorImportacion &&
        error.detalles.some(
          (detalle) => detalle.campo === 'metadata.campo_extra' && /no reconocido/.test(detalle.motivo)
        ) &&
        error.detalles.some(
          (detalle) => detalle.campo === 'descuento' && /no reconocido/.test(detalle.motivo)
        )
    );
  } finally {
    fs.rmSync(directorio, { recursive: true, force: true });
  }
});

test('rechaza un producto con precio distinto entre archivos', () => {
  const directorio = fs.mkdtempSync(path.join(os.tmpdir(), 'renefull-demo-'));
  const primero = { metadata: metadata(), ventas: [venta()] };
  const segundo = {
    metadata: metadata({ conjunto: 'prueba_demo_2' }),
    ventas: [
      venta({ id_venta: 'D01-002', precio_unitario_mxn: 32, total_mxn: 64 }),
    ],
  };
  fs.writeFileSync(path.join(directorio, 'uno.json'), JSON.stringify(primero), 'utf8');
  fs.writeFileSync(path.join(directorio, 'dos.json'), JSON.stringify(segundo), 'utf8');

  try {
    assert.throws(
      () => cargarDirectorioDemo(directorio),
      (error) =>
        error instanceof ErrorImportacion &&
        error.detalles.some((detalle) => /nombre, categoría o precio distintos/.test(detalle.motivo))
    );
  } finally {
    fs.rmSync(directorio, { recursive: true, force: true });
  }
});

test('rechaza un producto con nombre distinto entre archivos', () => {
  const directorio = fs.mkdtempSync(path.join(os.tmpdir(), 'renefull-demo-'));
  const primero = { metadata: metadata(), ventas: [venta()] };
  const segundo = {
    metadata: metadata({ conjunto: 'prueba_demo_2' }),
    ventas: [venta({ id_venta: 'D01-002', producto: 'Otro jugo' })],
  };
  fs.writeFileSync(path.join(directorio, 'uno.json'), JSON.stringify(primero), 'utf8');
  fs.writeFileSync(path.join(directorio, 'dos.json'), JSON.stringify(segundo), 'utf8');

  try {
    assert.throws(
      () => cargarDirectorioDemo(directorio),
      (error) =>
        error instanceof ErrorImportacion &&
        error.detalles.some((detalle) => /nombre, categoría o precio distintos/.test(detalle.motivo))
    );
  } finally {
    fs.rmSync(directorio, { recursive: true, force: true });
  }
});

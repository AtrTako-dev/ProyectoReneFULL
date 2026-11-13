const path = require('node:path');

if (process.env.NODE_ENV !== 'test') {
  try {
    process.loadEnvFile(path.join(__dirname, '..', '..', '.env'));
  } catch {
    // Sin .env se usan las variables del proceso.
  }
}

function variable(nombre, valorPorDefecto) {
  const valor = process.env[nombre];
  if (valor === undefined || valor === '') {
    if (valorPorDefecto === undefined) {
      throw new Error(`Falta la variable de entorno obligatoria: ${nombre}`);
    }
    return valorPorDefecto;
  }
  return valor;
}

function entero(nombre, valorPorDefecto, { minimo = 1, maximo = Number.MAX_SAFE_INTEGER } = {}) {
  const valor = Number(variable(nombre, String(valorPorDefecto)));
  if (!Number.isInteger(valor) || valor < minimo || valor > maximo) {
    throw new Error(`${nombre} debe ser un entero entre ${minimo} y ${maximo}.`);
  }
  return valor;
}

function decimal(nombre, valorPorDefecto) {
  const valor = Number(variable(nombre, String(valorPorDefecto)));
  if (!Number.isFinite(valor) || valor <= 0) {
    throw new Error(`${nombre} debe ser un número mayor que cero.`);
  }
  return valor;
}

const configuracion = {
  db: {
    host: variable('DB_HOST', '127.0.0.1'),
    puerto: entero('DB_PUERTO', 3306, { minimo: 1, maximo: 65535 }),
    usuario: variable('DB_USUARIO', 'renefull_app'),
    contrasena: variable('DB_CONTRASENA', ''),
    nombre: variable('DB_NOMBRE', 'proyecto_renefull'),
    conexiones: entero('DB_CONEXIONES', 10, { minimo: 1, maximo: 100 }),
  },
  demo: {
    email: variable('DEMO_EMAIL', 'cliente.demo@example.com'),
    nombre: variable('DEMO_NOMBRE', 'Cliente de Demostracion'),
    password: variable('DEMO_PASSWORD', ''),
  },
  importacion: {
    importadoPorEmail: variable('IMPORTADO_POR_EMAIL', ''),
  },
  ml: {
    minimoSemanas: entero('MIN_SEMANAS_ENTRENAMIENTO', 12, { minimo: 6, maximo: 260 }),
    minimoSemanasConUnidades: entero('MIN_SEMANAS_CON_UNIDADES', 8, { minimo: 4, maximo: 260 }),
    semanasEvaluacion: entero('SEMANAS_EVALUACION', 5, { minimo: 1, maximo: 52 }),
    alpha: decimal('ALPHA_RIDGE', 1.0),
  },
  pruebas: {
    nombreBase: variable('TEST_DB_NOMBRE', 'proyectorenefull_test'),
  },
  rutas: {
    datosDemo: path.join(__dirname, '..', '..', 'data', 'demo'),
    migraciones: path.join(__dirname, '..', '..', 'db', 'migraciones'),
  },
};

module.exports = { configuracion };

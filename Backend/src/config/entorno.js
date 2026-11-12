const path = require('node:path');

try {
  process.loadEnvFile(path.join(__dirname, '..', '..', '.env'));
} catch {
  // Sin archivo .env se usan las variables definidas en el entorno del proceso.
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

const configuracion = {
  puerto: Number(variable('PUERTO', '3000')),
  db: {
    host: variable('DB_HOST', '127.0.0.1'),
    puerto: Number(variable('DB_PUERTO', '3306')),
    usuario: variable('DB_USUARIO', 'renefull_app'),
    contrasena: variable('DB_CONTRASENA', ''),
    nombre: variable('DB_NOMBRE', 'proyecto_renefull'),
  },
  jwt: {
    secreto: variable('JWT_SECRETO'),
    horas: Number(variable('JWT_HORAS', '8')),
  },
  admin: {
    nombre: variable('ADMIN_NOMBRE', 'Administrador'),
    email: variable('ADMIN_EMAIL', ''),
    contrasena: variable('ADMIN_CONTRASENA', ''),
  },
  demo: {
    email: variable('DEMO_EMAIL', ''),
  },
};

module.exports = { configuracion };

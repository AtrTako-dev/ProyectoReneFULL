const argon2 = require('@node-rs/argon2');

// Parámetros de Argon2id recomendados por OWASP para contraseñas de acceso.
const OPCIONES = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

async function hashear(contrasena) {
  return argon2.hash(contrasena, OPCIONES);
}

async function verificar(hash, contrasena) {
  try {
    return await argon2.verify(hash, contrasena);
  } catch {
    return false;
  }
}

module.exports = { hashear, verificar };

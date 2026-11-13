const jwt = require('jsonwebtoken');
const { configuracion } = require('../config/entorno');

function firmarToken(usuarioId) {
  return jwt.sign({ sub: String(usuarioId) }, configuracion.jwt.secreto, {
    expiresIn: `${configuracion.jwt.horas}h`,
  });
}

function verificarToken(token) {
  return jwt.verify(token, configuracion.jwt.secreto);
}

module.exports = { firmarToken, verificarToken };

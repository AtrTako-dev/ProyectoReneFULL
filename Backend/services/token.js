const jwt = require('jsonwebtoken');
const { configuracion } = require('../config/entorno');

function firmarToken(usuarioId, config = configuracion) {
  return jwt.sign({ sub: String(usuarioId) }, config.jwt.secreto, {
    expiresIn: `${config.jwt.horas}h`,
  });
}

function verificarToken(token, config = configuracion) {
  return jwt.verify(token, config.jwt.secreto);
}

module.exports = { firmarToken, verificarToken };

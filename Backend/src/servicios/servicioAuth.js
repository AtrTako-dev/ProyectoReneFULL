const { configuracion } = require('../config/entorno');
const { hashear, verificar } = require('./password');
const { firmarToken, verificarToken } = require('./token');

class ServicioAuth {
  constructor({ config = configuracion, operacionesPassword = { hashear, verificar }, operacionesToken = { firmarToken, verificarToken } } = {}) {
    this.config = config;
    this.operacionesPassword = operacionesPassword;
    this.operacionesToken = operacionesToken;
  }

  hashear = (contrasena) => this.operacionesPassword.hashear(contrasena);
  verificar = (hash, contrasena) => this.operacionesPassword.verificar(hash, contrasena);
  crearToken = (usuarioId) => this.operacionesToken.firmarToken(usuarioId, this.config);
  verificarToken = (token) => this.operacionesToken.verificarToken(token, this.config);
}

module.exports = ServicioAuth;

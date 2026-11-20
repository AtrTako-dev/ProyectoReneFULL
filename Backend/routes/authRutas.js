const express = require('express');
const { envolverAsync } = require('../middleware/errores');

function crearAuthRutas({ controlador, requiereAutenticacion, cargarUsuarioActual }) {
  const router = express.Router();
  router.post('/registro', envolverAsync(controlador.registro));
  router.post('/login', envolverAsync(controlador.login));
  router.get('/me', requiereAutenticacion, envolverAsync(cargarUsuarioActual), controlador.me);
  return router;
}

module.exports = { crearAuthRutas };

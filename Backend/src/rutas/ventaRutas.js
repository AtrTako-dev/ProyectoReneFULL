const express = require('express');
const { envolverAsync } = require('../middleware/errores');

function crearVentaRutas({ controlador, requiereAutenticacion, cargarUsuarioActual }) {
  const router = express.Router();
  router.use(requiereAutenticacion, envolverAsync(cargarUsuarioActual));
  router.post('/', envolverAsync(controlador.crear));
  router.get('/mias', envolverAsync(controlador.listarMias));
  router.get('/mias/estadisticas', envolverAsync(controlador.estadisticasMias));
  router.get('/mias/predicciones', envolverAsync(controlador.prediccionesMias));
  return router;
}

module.exports = { crearVentaRutas };

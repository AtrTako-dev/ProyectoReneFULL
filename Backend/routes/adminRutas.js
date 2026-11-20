const express = require('express');
const { envolverAsync } = require('../middleware/errores');

function crearAdminRutas({ controlador, requiereAutenticacion, requiereAdministrador }) {
  const router = express.Router();
  router.use(requiereAutenticacion, envolverAsync(requiereAdministrador));
  router.get('/usuarios', envolverAsync(controlador.listarUsuarios));
  router.patch('/usuarios/:id/rol', envolverAsync(controlador.cambiarRol));
  router.get('/estadisticas/ventas', envolverAsync(controlador.estadisticasVentas));
  router.get('/predicciones/demanda', envolverAsync(controlador.prediccionesDemanda));
  return router;
}

module.exports = { crearAdminRutas };

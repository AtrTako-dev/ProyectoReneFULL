const express = require('express');
const controlador = require('../controladores/adminControlador');
const { requiereAutenticacion, requiereAdministrador } = require('../middleware/auth');
const { envolverAsync } = require('../middleware/errores');

const router = express.Router();

router.use(requiereAutenticacion, envolverAsync(requiereAdministrador));

router.get('/usuarios', envolverAsync(controlador.listarUsuarios));
router.patch('/usuarios/:id/rol', envolverAsync(controlador.cambiarRol));
router.get('/estadisticas/ventas', envolverAsync(controlador.estadisticasVentas));
router.get('/predicciones/demanda', envolverAsync(controlador.prediccionesDemanda));

module.exports = router;

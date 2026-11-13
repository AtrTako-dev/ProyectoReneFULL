const express = require('express');
const controlador = require('../controladores/ventaControlador');
const { requiereAutenticacion, cargarUsuarioActual } = require('../middleware/auth');
const { envolverAsync } = require('../middleware/errores');

const router = express.Router();

// El propietario de las ventas se deriva siempre de la sesión autenticada.
router.use(requiereAutenticacion, envolverAsync(cargarUsuarioActual));

router.post('/', envolverAsync(controlador.crear));
router.get('/mias', envolverAsync(controlador.listarMias));
router.get('/mias/estadisticas', envolverAsync(controlador.estadisticasMias));
router.get('/mias/predicciones', envolverAsync(controlador.prediccionesMias));

module.exports = router;

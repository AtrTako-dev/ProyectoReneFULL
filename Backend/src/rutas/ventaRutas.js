const express = require('express');
const controlador = require('../controladores/ventaControlador');
const { requiereAutenticacion } = require('../middleware/auth');
const { envolverAsync } = require('../middleware/errores');

const router = express.Router();

router.use(requiereAutenticacion);

router.post('/', envolverAsync(controlador.crear));
router.get('/mias', envolverAsync(controlador.listarMias));
router.get('/mias/estadisticas', envolverAsync(controlador.estadisticasMias));
router.get('/mias/predicciones', envolverAsync(controlador.prediccionesMias));

module.exports = router;

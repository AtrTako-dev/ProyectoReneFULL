const express = require('express');
const controlador = require('../controladores/authControlador');
const { requiereAutenticacion, cargarUsuarioActual } = require('../middleware/auth');
const { envolverAsync } = require('../middleware/errores');

const router = express.Router();

router.post('/registro', envolverAsync(controlador.registro));
router.post('/login', envolverAsync(controlador.login));
router.get('/me', requiereAutenticacion, envolverAsync(cargarUsuarioActual), controlador.me);

module.exports = router;

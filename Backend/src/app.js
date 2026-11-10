const express = require('express');
const authRutas = require('./rutas/authRutas');
const ventaRutas = require('./rutas/ventaRutas');
const adminRutas = require('./rutas/adminRutas');
const { manejadorErrores, manejadorNoEncontrado } = require('./middleware/errores');

const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));

app.get('/api/salud', (req, res) => res.json({ estado: 'ok' }));

app.use('/api/auth', authRutas);
app.use('/api/ventas', ventaRutas);
app.use('/api/admin', adminRutas);

app.use(manejadorNoEncontrado);
app.use(manejadorErrores);

module.exports = app;

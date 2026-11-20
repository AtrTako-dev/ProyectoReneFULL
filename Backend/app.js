const express = require('express');
const { BaseDatos } = require('./config/database');
const ServicioAuth = require('./services/servicioAuth');
const UsuarioModelo = require('./models/usuarioModelo');
const VentaModelo = require('./models/ventaModelo');
const ProductoModelo = require('./models/productoModelo');
const AuthControlador = require('./controllers/authControlador');
const VentaControlador = require('./controllers/ventaControlador');
const AdminControlador = require('./controllers/adminControlador');
const { crearAuthRutas } = require('./routes/authRutas');
const { crearVentaRutas } = require('./routes/ventaRutas');
const { crearAdminRutas } = require('./routes/adminRutas');
const { crearRequiereAutenticacion, crearCargarUsuarioActual, crearRequiereRol } = require('./middleware/auth');
const { manejadorErrores, manejadorNoEncontrado } = require('./middleware/errores');

function crearApp({ baseDatos = new BaseDatos(), servicioAuth = new ServicioAuth(), modelos = {} } = {}) {
  const usuarioModelo = modelos.usuario || new UsuarioModelo(baseDatos);
  const ventaModelo = modelos.venta || new VentaModelo(baseDatos);
  const productoModelo = modelos.producto || new ProductoModelo(baseDatos);

  const requiereAutenticacion = crearRequiereAutenticacion({
    verificar: servicioAuth.verificarToken,
  });
  const cargarUsuarioActual = crearCargarUsuarioActual({ usuarioModelo });
  const requiereAdministrador = crearRequiereRol(['administrador'], { usuarioModelo });

  const authControlador = new AuthControlador({ usuarioModelo, servicioAuth });
  const ventaControlador = new VentaControlador({ ventaModelo, productoModelo });
  const adminControlador = new AdminControlador({ usuarioModelo, ventaModelo });

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  app.get('/api/salud', (req, res) => res.json({ estado: 'ok' }));
  app.use('/api/auth', crearAuthRutas({ controlador: authControlador, requiereAutenticacion, cargarUsuarioActual }));
  app.use('/api/ventas', crearVentaRutas({ controlador: ventaControlador, requiereAutenticacion, cargarUsuarioActual }));
  app.use('/api/admin', crearAdminRutas({ controlador: adminControlador, requiereAutenticacion, requiereAdministrador }));
  app.use(manejadorNoEncontrado);
  app.use(manejadorErrores);
  return app;
}

module.exports = { crearApp };

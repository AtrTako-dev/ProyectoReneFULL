const express = require('express');
const { BaseDatos } = require('./db/conexion');
const ServicioAuth = require('./servicios/servicioAuth');
const UsuarioModelo = require('./modelos/usuarioModelo');
const VentaModelo = require('./modelos/ventaModelo');
const ProductoModelo = require('./modelos/productoModelo');
const AuthControlador = require('./controladores/authControlador');
const VentaControlador = require('./controladores/ventaControlador');
const AdminControlador = require('./controladores/adminControlador');
const { crearAuthRutas } = require('./rutas/authRutas');
const { crearVentaRutas } = require('./rutas/ventaRutas');
const { crearAdminRutas } = require('./rutas/adminRutas');
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

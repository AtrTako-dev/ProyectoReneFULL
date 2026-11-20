const { ErrorApi, errores } = require('../middleware/errores');
const { esUuid } = require('../validaciones/comunes');
const { usuarioPublico } = require('../services/serializadores');
const { filtrarVentasValidas } = require('../services/registros');
const { estadisticasAdmin } = require('../services/estadisticas');
const { predecirTodasLasCategorias } = require('../services/prediccion');
const { validarCambioRol, validarAgrupacion, validarClienteId } = require('../validaciones/admin');
const { validarRangoFechas } = require('../validaciones/ventas');

function contarExcluidosPorPropietario(invalidas) {
  const mapa = new Map();
  for (const { fila } of invalidas) {
    const propietarioId = fila && fila.propietario_id;
    if (typeof propietarioId === 'string' && esUuid(propietarioId)) {
      mapa.set(propietarioId, (mapa.get(propietarioId) || 0) + 1);
    }
  }
  return mapa;
}

class AdminControlador {
  constructor({ usuarioModelo, ventaModelo }) {
    this.usuarioModelo = usuarioModelo;
    this.ventaModelo = ventaModelo;
  }

  listarUsuarios = async (req, res, next) => {
    try {
      const usuarios = await this.usuarioModelo.listar();
      return res.json({ usuarios: usuarios.map((usuario) => ({
        ...usuarioPublico(usuario), creado_en: usuario.creado_en, actualizado_en: usuario.actualizado_en,
      })) });
    } catch (error) { return next(error); }
  };

  cambiarRol = async (req, res, next) => {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id.trim().toLowerCase() : '';
      if (!esUuid(id)) return next(errores.noEncontrado('El usuario indicado no existe.'));
      const { campos, rol } = validarCambioRol(req.body);
      if (Object.keys(campos).length > 0) return next(errores.validacion(campos));
      if (id === req.usuario.id) {
        return next(new ErrorApi(403, 'NO_AUTORIZADO', 'Un administrador no puede modificar su propio rol.'));
      }
      const destino = await this.usuarioModelo.buscarPorId(id);
      if (!destino) return next(errores.noEncontrado('El usuario indicado no existe.'));
      const actualizado = await this.usuarioModelo.actualizarRol(id, rol);
      return res.json({ usuario: usuarioPublico(actualizado) });
    } catch (error) { return next(error); }
  };

  estadisticasVentas = async (req, res, next) => {
    try {
      const { campos, rango } = validarRangoFechas(req.query);
      const agrupacion = validarAgrupacion(req.query.agrupacion);
      Object.assign(campos, agrupacion.campos);
      if (Object.keys(campos).length > 0) return next(errores.validacion(campos));
      const [filas, usuarios] = await Promise.all([
        this.ventaModelo.listarGlobal(rango), this.usuarioModelo.listar(),
      ]);
      const { validas, invalidas } = filtrarVentasValidas(filas);
      return res.json(estadisticasAdmin(validas, usuarios, {
        desde: rango.desde, hasta: rango.hasta, agrupacion: agrupacion.agrupacion,
        registrosExcluidos: invalidas.length,
        excluidosPorPropietario: contarExcluidosPorPropietario(invalidas),
      }));
    } catch (error) { return next(error); }
  };

  prediccionesDemanda = async (req, res, next) => {
    try {
      const { campos, clienteId } = validarClienteId(req.query.cliente_id);
      if (Object.keys(campos).length > 0) return next(errores.validacion(campos));
      const cliente = await this.usuarioModelo.buscarPorId(clienteId);
      if (!cliente) return next(errores.noEncontrado('El cliente indicado no existe.'));
      const filas = await this.ventaModelo.listarPorPropietario(clienteId, {});
      const { validas } = filtrarVentasValidas(filas);
      return res.json({ cliente: usuarioPublico(cliente), predicciones: predecirTodasLasCategorias(validas) });
    } catch (error) { return next(error); }
  };
}

module.exports = AdminControlador;

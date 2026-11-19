const { ErrorApi, errores } = require('../middleware/errores');
const { estaActivo } = require('../middleware/auth');
const { usuarioPublico } = require('../servicios/serializadores');
const { validarRegistro, validarLogin } = require('../validaciones/auth');

class AuthControlador {
  constructor({ usuarioModelo, servicioAuth }) {
    this.usuarioModelo = usuarioModelo;
    this.servicioAuth = servicioAuth;
  }

  respuestaSesion = (usuario) => ({
    token: this.servicioAuth.crearToken(usuario.id),
    usuario: usuarioPublico(usuario),
  });

  registro = async (req, res, next) => {
    try {
      const { campos, datos } = validarRegistro(req.body);
      if (Object.keys(campos).length > 0) return next(errores.validacion(campos));

      const existente = await this.usuarioModelo.buscarPorCorreo(datos.email);
      if (existente) return next(errores.conflicto('El correo ya está registrado.'));

      const contrasenaHash = await this.servicioAuth.hashear(datos.password);
      try {
        const usuario = await this.usuarioModelo.crear({
          nombre: datos.nombre,
          correo: datos.email,
          contrasenaHash,
          rol: 'cliente',
        });
        return res.status(201).json(this.respuestaSesion(usuario));
      } catch (error) {
        if (error && error.code === 'ER_DUP_ENTRY') {
          return next(errores.conflicto('El correo ya está registrado.'));
        }
        throw error;
      }
    } catch (error) { return next(error); }
  };

  login = async (req, res, next) => {
    try {
      const { campos, datos } = validarLogin(req.body);
      if (Object.keys(campos).length > 0) return next(errores.validacion(campos));

      const usuario = await this.usuarioModelo.buscarPorCorreo(datos.email);
      const contrasenaCorrecta = usuario
        ? await this.servicioAuth.verificar(usuario.password_hash, datos.password)
        : false;
      if (!usuario || !contrasenaCorrecta || !estaActivo(usuario)) {
        return next(new ErrorApi(401, 'NO_AUTENTICADO', 'Correo o contraseña incorrectos.'));
      }
      return res.json(this.respuestaSesion(usuario));
    } catch (error) { return next(error); }
  };

  me = (req, res) => res.json({ usuario: usuarioPublico(req.usuario) });
}

module.exports = AuthControlador;

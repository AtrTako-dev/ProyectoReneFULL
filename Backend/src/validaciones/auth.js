const {
  esObjeto,
  textoObligatorio,
  emailValido,
  contrasenaValida,
} = require('./comunes');

function validarRegistro(cuerpo) {
  const campos = {};
  if (!esObjeto(cuerpo)) {
    campos.cuerpo = 'El cuerpo debe ser un objeto JSON';
    return { campos, datos: null };
  }

  if (Object.prototype.hasOwnProperty.call(cuerpo, 'rol')) {
    campos.rol = 'No está permitido asignar roles desde el registro';
  }

  // El formulario móvil envía `email`; la columna MySQL equivalente es `correo`.
  const nombre = textoObligatorio(cuerpo.nombre, 'nombre', campos, {
    maximo: 120,
    etiqueta: 'El nombre',
  });
  const email = emailValido(cuerpo.email, 'email', campos);
  const password = contrasenaValida(cuerpo.password, 'password', campos);

  return { campos, datos: { nombre, email, password } };
}

function validarLogin(cuerpo) {
  const campos = {};
  if (!esObjeto(cuerpo)) {
    campos.cuerpo = 'El cuerpo debe ser un objeto JSON';
    return { campos, datos: null };
  }

  const email = emailValido(cuerpo.email, 'email', campos);
  const password = textoObligatorio(cuerpo.password, 'password', campos, {
    maximo: 128,
    etiqueta: 'La contraseña',
  });

  return { campos, datos: { email, password } };
}

module.exports = { validarRegistro, validarLogin };

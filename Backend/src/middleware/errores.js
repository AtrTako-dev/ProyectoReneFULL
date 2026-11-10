class ErrorApi extends Error {
  constructor(estado, codigo, mensaje, campos) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.estado = estado;
    this.codigo = codigo;
    this.mensaje = mensaje;
    this.campos = campos;
  }
}

const errores = {
  jsonInvalido() {
    return new ErrorApi(400, 'JSON_INVALIDO', 'El cuerpo de la solicitud no es un JSON válido.');
  },
  validacion(campos) {
    return new ErrorApi(422, 'VALIDACION_DATOS', 'Los datos enviados no son válidos.', campos);
  },
  noAutenticado() {
    return new ErrorApi(401, 'NO_AUTENTICADO', 'Se requiere una sesión válida.');
  },
  noAutorizado() {
    return new ErrorApi(403, 'NO_AUTORIZADO', 'No tienes permiso para realizar esta operación.');
  },
  noEncontrado(mensaje = 'El recurso solicitado no existe.') {
    return new ErrorApi(404, 'NO_ENCONTRADO', mensaje);
  },
  conflicto(mensaje = 'La operación entra en conflicto con el estado actual.') {
    return new ErrorApi(409, 'CONFLICTO', mensaje);
  },
  interno() {
    return new ErrorApi(500, 'ERROR_INTERNO', 'Ocurrió un error interno. Intenta más tarde.');
  },
};

function responderError(res, error) {
  if (error instanceof ErrorApi) {
    const cuerpo = { error: { codigo: error.codigo, mensaje: error.mensaje } };
    if (error.campos) {
      cuerpo.error.campos = error.campos;
    }
    return res.status(error.estado).json(cuerpo);
  }

  if (error && error.type === 'entity.parse.failed') {
    const errorJson = errores.jsonInvalido();
    return res
      .status(errorJson.estado)
      .json({ error: { codigo: errorJson.codigo, mensaje: errorJson.mensaje } });
  }

  if (process.env.NODE_ENV !== 'test') {
    console.error(error);
  }
  const errorInterno = errores.interno();
  return res
    .status(errorInterno.estado)
    .json({ error: { codigo: errorInterno.codigo, mensaje: errorInterno.mensaje } });
}

function manejadorErrores(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }
  return responderError(res, error);
}

function manejadorNoEncontrado(req, res) {
  return responderError(res, errores.noEncontrado('La ruta solicitada no existe.'));
}

function envolverAsync(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = {
  ErrorApi,
  errores,
  responderError,
  manejadorErrores,
  manejadorNoEncontrado,
  envolverAsync,
};

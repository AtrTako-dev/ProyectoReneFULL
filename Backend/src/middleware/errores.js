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
  noAutorizado(mensaje = 'No tienes permiso para realizar esta operación.') {
    return new ErrorApi(403, 'NO_AUTORIZADO', mensaje);
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

// Traduccion de errores de MySQL a respuestas controladas. Nunca se devuelve
// el mensaje original porque puede incluir nombres de tablas o valores.
const ERRORES_BD = {
  ER_DUP_ENTRY: [409, 'CONFLICTO', 'Ya existe un registro con esos datos.'],
  ER_NO_REFERENCED_ROW: [422, 'VALIDACION_DATOS', 'La referencia indicada no existe.'],
  ER_NO_REFERENCED_ROW_2: [422, 'VALIDACION_DATOS', 'La referencia indicada no existe.'],
  ER_ROW_IS_REFERENCED_2: [
    409,
    'CONFLICTO',
    'El registro está en uso y no se puede modificar.',
  ],
  ER_DATA_TOO_LONG: [422, 'VALIDACION_DATOS', 'Uno de los valores excede la longitud permitida.'],
  ER_WARN_DATA_OUT_OF_RANGE: [
    422,
    'VALIDACION_DATOS',
    'Uno de los valores está fuera del rango permitido.',
  ],
  ER_TRUNCATED_WRONG_VALUE: [
    422,
    'VALIDACION_DATOS',
    'Uno de los valores no tiene el formato esperado.',
  ],
  ER_TRUNCATED_WRONG_VALUE_FOR_FIELD: [
    422,
    'VALIDACION_DATOS',
    'Uno de los valores no tiene el formato esperado.',
  ],
  WARN_DATA_TRUNCATED: [
    422,
    'VALIDACION_DATOS',
    'Uno de los valores no tiene el formato esperado.',
  ],
  ER_BAD_NULL_ERROR: [422, 'VALIDACION_DATOS', 'Falta un valor obligatorio.'],
};

function traducirErrorBd(error) {
  if (!error || typeof error.code !== 'string') {
    return null;
  }
  const definicion = ERRORES_BD[error.code];
  if (!definicion) {
    return null;
  }
  return new ErrorApi(definicion[0], definicion[1], definicion[2]);
}

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

  const errorBd = traducirErrorBd(error);
  if (errorBd) {
    return res
      .status(errorBd.estado)
      .json({ error: { codigo: errorBd.codigo, mensaje: errorBd.mensaje } });
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
  ERRORES_BD,
  traducirErrorBd,
  responderError,
  manejadorErrores,
  manejadorNoEncontrado,
  envolverAsync,
};

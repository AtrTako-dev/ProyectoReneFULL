class ErrorDatos extends Error {
  constructor(codigo, mensaje, detalles = undefined) {
    super(mensaje);
    this.name = 'ErrorDatos';
    this.codigo = codigo;
    this.detalles = detalles;
  }
}

class ErrorValidacionDatos extends ErrorDatos {
  constructor(errores, mensaje = 'Los datos no cumplen las validaciones.') {
    super('VALIDACION_DATOS', mensaje, { errores });
    this.name = 'ErrorValidacionDatos';
    this.errores = errores;
  }
}

class ErrorConflictoImportacion extends ErrorDatos {
  constructor(mensaje, detalles = undefined) {
    super('CONFLICTO_IMPORTACION', mensaje, detalles);
    this.name = 'ErrorConflictoImportacion';
  }
}

class ErrorOperacionNoPermitida extends ErrorDatos {
  constructor(mensaje, detalles = undefined) {
    super('OPERACION_NO_PERMITIDA', mensaje, detalles);
    this.name = 'ErrorOperacionNoPermitida';
  }
}

class ErrorRegistroInvalido extends ErrorDatos {
  constructor(idVenta, problemas) {
    super('REGISTRO_INVALIDO', 'La venta contiene datos inválidos.', { id_venta: idVenta, problemas });
    this.name = 'ErrorRegistroInvalido';
    this.idVenta = idVenta;
    this.problemas = problemas;
  }
}

class ErrorNoEncontrado extends ErrorDatos {
  constructor(mensaje = 'El registro no existe.', detalles = undefined) {
    super('NO_ENCONTRADO', mensaje, detalles);
    this.name = 'ErrorNoEncontrado';
  }
}

function aErrorPublico(error) {
  if (error instanceof ErrorDatos) {
    return {
      codigo: error.codigo,
      mensaje: error.message,
      detalles: error.detalles,
    };
  }
  return {
    codigo: 'ERROR_INTERNO',
    mensaje: 'No fue posible completar la operación.',
  };
}

module.exports = {
  ErrorDatos,
  ErrorValidacionDatos,
  ErrorConflictoImportacion,
  ErrorOperacionNoPermitida,
  ErrorRegistroInvalido,
  ErrorNoEncontrado,
  aErrorPublico,
};

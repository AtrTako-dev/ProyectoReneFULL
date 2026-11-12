const { esObjeto, uuidObligatorio } = require('./comunes');

const ROLES = ['cliente', 'administrador'];
const AGRUPACIONES = ['semana', 'mes'];

function validarCambioRol(cuerpo) {
  const campos = {};
  if (!esObjeto(cuerpo)) {
    campos.cuerpo = 'El cuerpo debe ser un objeto JSON';
    return { campos, rol: null };
  }

  if (cuerpo.rol === undefined || cuerpo.rol === null || cuerpo.rol === '') {
    campos.rol = 'El rol es obligatorio';
    return { campos, rol: null };
  }
  if (typeof cuerpo.rol !== 'string' || !ROLES.includes(cuerpo.rol)) {
    campos.rol = `El rol debe ser uno de: ${ROLES.join(', ')}`;
    return { campos, rol: null };
  }
  return { campos, rol: cuerpo.rol };
}

function validarAgrupacion(valor, predeterminada = 'semana') {
  if (valor === undefined || valor === null || valor === '') {
    return { campos: {}, agrupacion: predeterminada };
  }
  if (typeof valor !== 'string' || !AGRUPACIONES.includes(valor)) {
    return {
      campos: { agrupacion: `La agrupación debe ser una de: ${AGRUPACIONES.join(', ')}` },
      agrupacion: null,
    };
  }
  return { campos: {}, agrupacion: valor };
}

function validarClienteId(valor) {
  const campos = {};
  const clienteId = uuidObligatorio(valor, 'cliente_id', campos, 'El cliente');
  return { campos, clienteId };
}

module.exports = {
  ROLES,
  AGRUPACIONES,
  validarCambioRol,
  validarAgrupacion,
  validarClienteId,
};

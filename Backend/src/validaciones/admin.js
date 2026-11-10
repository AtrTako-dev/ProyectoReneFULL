const { esObjeto } = require('./comunes');

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

function validarAgrupacion(valor) {
  if (valor === undefined || valor === null || valor === '') {
    return { campos: { agrupacion: 'La agrupación es obligatoria' }, agrupacion: null };
  }
  if (typeof valor !== 'string' || !AGRUPACIONES.includes(valor)) {
    return {
      campos: { agrupacion: `La agrupación debe ser una de: ${AGRUPACIONES.join(', ')}` },
      agrupacion: null,
    };
  }
  return { campos: {}, agrupacion: valor };
}

module.exports = { ROLES, AGRUPACIONES, validarCambioRol, validarAgrupacion };

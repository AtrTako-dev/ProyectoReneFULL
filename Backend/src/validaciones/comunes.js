const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const FORMATO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function esObjeto(valor) {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor);
}

function textoObligatorio(valor, campo, campos, opciones = {}) {
  const { minimo = 1, maximo = 255, etiqueta = campo } = opciones;
  if (valor === undefined || valor === null || valor === '') {
    campos[campo] = `${etiqueta} es obligatorio`;
    return null;
  }
  if (typeof valor !== 'string') {
    campos[campo] = `${etiqueta} debe ser texto`;
    return null;
  }
  const limpio = valor.trim();
  if (limpio.length < minimo) {
    campos[campo] = `${etiqueta} debe tener al menos ${minimo} caracteres`;
    return null;
  }
  if (limpio.length > maximo) {
    campos[campo] = `${etiqueta} debe tener como máximo ${maximo} caracteres`;
    return null;
  }
  return limpio;
}

function emailValido(valor, campo, campos) {
  const limpio = textoObligatorio(valor, campo, campos, { maximo: 254, etiqueta: 'El correo' });
  if (limpio === null) {
    return null;
  }
  const normalizado = limpio.toLowerCase();
  if (!FORMATO_EMAIL.test(normalizado)) {
    campos[campo] = 'El correo no tiene un formato válido';
    return null;
  }
  return normalizado;
}

function contrasenaValida(valor, campo, campos) {
  const limpia = textoObligatorio(valor, campo, campos, { minimo: 8, maximo: 128, etiqueta: 'La contraseña' });
  return limpia;
}

function enteroPositivo(valor, campo, campos, etiqueta = campo) {
  if (valor === undefined || valor === null || valor === '') {
    campos[campo] = `${etiqueta} es obligatorio`;
    return null;
  }
  const numero = typeof valor === 'string' && valor.trim() !== '' ? Number(valor) : valor;
  if (typeof numero !== 'number' || !Number.isFinite(numero) || !Number.isInteger(numero)) {
    campos[campo] = `${etiqueta} debe ser un número entero`;
    return null;
  }
  if (numero < 1) {
    campos[campo] = `${etiqueta} debe ser mayor que 0`;
    return null;
  }
  return numero;
}

function numeroNoNegativo(valor, campo, campos, etiqueta = campo) {
  if (valor === undefined || valor === null || valor === '') {
    campos[campo] = `${etiqueta} es obligatorio`;
    return null;
  }
  const numero = typeof valor === 'string' && valor.trim() !== '' ? Number(valor) : valor;
  if (typeof numero !== 'number' || !Number.isFinite(numero)) {
    campos[campo] = `${etiqueta} debe ser un número válido`;
    return null;
  }
  if (numero < 0) {
    campos[campo] = `${etiqueta} no puede ser negativo`;
    return null;
  }
  return redondear(numero);
}

function redondear(valor, decimales = 2) {
  const factor = 10 ** decimales;
  return Math.round((valor + Number.EPSILON) * factor) / factor;
}

function fechaValida(valor, campo, campos, { permitirFutura = false } = {}) {
  if (valor === undefined || valor === null || valor === '') {
    campos[campo] = 'La fecha es obligatoria';
    return null;
  }
  if (typeof valor !== 'string' || !FORMATO_FECHA.test(valor)) {
    campos[campo] = 'La fecha debe tener el formato YYYY-MM-DD';
    return null;
  }
  const [anio, mes, dia] = valor.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  if (
    fecha.getUTCFullYear() !== anio ||
    fecha.getUTCMonth() !== mes - 1 ||
    fecha.getUTCDate() !== dia
  ) {
    campos[campo] = 'La fecha no es válida';
    return null;
  }
  if (!permitirFutura) {
    const ahora = new Date();
    const hoy = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate()));
    if (fecha > hoy) {
      campos[campo] = 'La fecha no puede ser futura';
      return null;
    }
  }
  return valor;
}

function fechaOpcional(valor, campo, campos) {
  if (valor === undefined || valor === null || valor === '') {
    return null;
  }
  return fechaValida(valor, campo, campos, { permitirFutura: true });
}

module.exports = {
  FORMATO_FECHA,
  esObjeto,
  textoObligatorio,
  emailValido,
  contrasenaValida,
  enteroPositivo,
  numeroNoNegativo,
  fechaValida,
  fechaOpcional,
  redondear,
};

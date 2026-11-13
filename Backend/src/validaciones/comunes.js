const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const FORMATO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Traduccion MySQL del identificador UUID del esquema logico acordado con Ismael.
const FORMATO_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// Patron del catalogo de productos del esquema acordado (ej. B003, D01-...).
const FORMATO_PRODUCTO = /^[A-Z]{1,3}[0-9]{3}$/;

const PRECIO_MAXIMO_MXN = 1000000;
const TOTAL_MAXIMO_MXN = 10000000;
const CANTIDAD_MAXIMA = 10000;

function esObjeto(valor) {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor);
}

function esTextoNoVacio(valor) {
  return typeof valor === 'string' && valor.trim() !== '';
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

function textoOpcional(valor, campo, campos, opciones = {}) {
  if (valor === undefined || valor === null || valor === '') {
    return null;
  }
  return textoObligatorio(valor, campo, campos, opciones);
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
  return textoObligatorio(valor, campo, campos, {
    minimo: 8,
    maximo: 128,
    etiqueta: 'La contraseña',
  });
}

function esUuid(valor) {
  return typeof valor === 'string' && FORMATO_UUID.test(valor.trim());
}

function uuidObligatorio(valor, campo, campos, etiqueta = 'El identificador') {
  const limpio = textoObligatorio(valor, campo, campos, {
    maximo: 36,
    etiqueta,
  });
  if (limpio === null) {
    return null;
  }
  if (!FORMATO_UUID.test(limpio)) {
    campos[campo] = `${etiqueta} no tiene un formato UUID válido`;
    return null;
  }
  return limpio.toLowerCase();
}

function uuidOpcional(valor, campo, campos) {
  if (valor === undefined || valor === null || valor === '') {
    return null;
  }
  return uuidObligatorio(valor, campo, campos);
}

function productoIdValido(valor, campo, campos) {
  const limpio = textoObligatorio(valor, campo, campos, {
    maximo: 20,
    etiqueta: 'El identificador de producto',
  });
  if (limpio === null) {
    return null;
  }
  if (!FORMATO_PRODUCTO.test(limpio)) {
    campos[campo] = 'El identificador de producto debe tener el formato del catálogo (por ejemplo B003)';
    return null;
  }
  return limpio;
}

function enteroEnRango(valor, campo, campos, { minimo, maximo, etiqueta = campo }) {
  if (valor === undefined || valor === null || valor === '') {
    campos[campo] = `${etiqueta} es obligatorio`;
    return null;
  }
  const numero = typeof valor === 'string' && valor.trim() !== '' ? Number(valor) : valor;
  if (typeof numero !== 'number' || !Number.isFinite(numero) || !Number.isInteger(numero)) {
    campos[campo] = `${etiqueta} debe ser un número entero`;
    return null;
  }
  if (numero < minimo) {
    campos[campo] = `${etiqueta} debe ser mayor o igual que ${minimo}`;
    return null;
  }
  if (numero > maximo) {
    campos[campo] = `${etiqueta} no puede superar ${maximo}`;
    return null;
  }
  return numero;
}

function numeroPositivo(valor, campo, campos, { maximo, etiqueta = campo } = {}) {
  if (valor === undefined || valor === null || valor === '') {
    campos[campo] = `${etiqueta} es obligatorio`;
    return null;
  }
  const numero = typeof valor === 'string' && valor.trim() !== '' ? Number(valor) : valor;
  if (typeof numero !== 'number' || !Number.isFinite(numero)) {
    campos[campo] = `${etiqueta} debe ser un número válido`;
    return null;
  }
  if (numero <= 0) {
    campos[campo] = `${etiqueta} debe ser mayor que 0`;
    return null;
  }
  if (maximo !== undefined && numero > maximo) {
    campos[campo] = `${etiqueta} no puede superar ${maximo}`;
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
  if (fecha.getUTCFullYear() < 2000) {
    campos[campo] = 'La fecha es anterior al límite permitido (2000-01-01)';
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
  FORMATO_EMAIL,
  FORMATO_UUID,
  FORMATO_PRODUCTO,
  PRECIO_MAXIMO_MXN,
  TOTAL_MAXIMO_MXN,
  CANTIDAD_MAXIMA,
  esObjeto,
  esTextoNoVacio,
  esUuid,
  textoObligatorio,
  textoOpcional,
  emailValido,
  contrasenaValida,
  uuidObligatorio,
  uuidOpcional,
  productoIdValido,
  enteroEnRango,
  numeroPositivo,
  fechaValida,
  fechaOpcional,
  redondear,
};

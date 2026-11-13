const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const MILISEGUNDOS_DIA = 24 * 60 * 60 * 1000;

function parseFecha(texto) {
  if (typeof texto !== 'string' || !FORMATO_FECHA.test(texto)) return null;
  const [anio, mes, dia] = texto.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  if (
    fecha.getUTCFullYear() !== anio ||
    fecha.getUTCMonth() !== mes - 1 ||
    fecha.getUTCDate() !== dia
  ) {
    return null;
  }
  return fecha;
}

function esFechaValida(texto) {
  return parseFecha(texto) !== null;
}

function formatearFecha(fecha) {
  return fecha.toISOString().slice(0, 10);
}

function hoyIso() {
  const ahora = new Date();
  return formatearFecha(
    new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate()))
  );
}

function sumarDias(texto, dias) {
  const fecha = parseFecha(texto);
  if (!fecha) throw new Error(`Fecha inválida: ${texto}`);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return formatearFecha(fecha);
}

function diferenciaDias(desde, hasta) {
  const inicio = parseFecha(desde);
  const fin = parseFecha(hasta);
  if (!inicio || !fin) throw new Error('Las fechas del rango no son válidas.');
  return Math.round((fin.getTime() - inicio.getTime()) / MILISEGUNDOS_DIA);
}

function inicioSemana(texto) {
  const fecha = parseFecha(texto);
  if (!fecha) throw new Error(`Fecha inválida: ${texto}`);
  const desplazamiento = (fecha.getUTCDay() + 6) % 7;
  fecha.setUTCDate(fecha.getUTCDate() - desplazamiento);
  return formatearFecha(fecha);
}

function finSemana(texto) {
  return sumarDias(inicioSemana(texto), 6);
}

function semanasCompletas(desde, hasta) {
  let inicio = inicioSemana(desde);
  if (inicio < desde) inicio = sumarDias(inicio, 7);
  const semanas = [];
  for (let cursor = inicio; cursor <= hasta; cursor = sumarDias(cursor, 7)) {
    const fin = sumarDias(cursor, 6);
    if (fin > hasta) break;
    semanas.push({ inicio: cursor, fin });
  }
  return semanas;
}

function etiquetaSemanaIso(texto) {
  const fecha = parseFecha(texto);
  if (!fecha) throw new Error(`Fecha inválida: ${texto}`);
  const jueves = new Date(fecha.getTime());
  const dia = (jueves.getUTCDay() + 6) % 7;
  jueves.setUTCDate(jueves.getUTCDate() - dia + 3);
  const primerJueves = new Date(Date.UTC(jueves.getUTCFullYear(), 0, 4));
  const diaPrimerJueves = (primerJueves.getUTCDay() + 6) % 7;
  primerJueves.setUTCDate(primerJueves.getUTCDate() - diaPrimerJueves + 3);
  const semana = 1 + Math.round((jueves.getTime() - primerJueves.getTime()) / (7 * MILISEGUNDOS_DIA));
  return `${jueves.getUTCFullYear()}-W${String(semana).padStart(2, '0')}`;
}

function etiquetaMes(texto) {
  const fecha = parseFecha(texto);
  if (!fecha) throw new Error(`Fecha inválida: ${texto}`);
  return texto.slice(0, 7);
}

function finMes(texto) {
  const fecha = parseFecha(texto);
  if (!fecha) throw new Error(`Fecha inválida: ${texto}`);
  return formatearFecha(
    new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth() + 1, 0))
  );
}

function mesDeFecha(texto) {
  return parseFecha(texto).getUTCMonth() + 1;
}

function rangoContiene(desde, hasta, fecha) {
  if (desde && fecha < desde) return false;
  if (hasta && fecha > hasta) return false;
  return true;
}

module.exports = {
  FORMATO_FECHA,
  MILISEGUNDOS_DIA,
  parseFecha,
  esFechaValida,
  formatearFecha,
  hoyIso,
  sumarDias,
  diferenciaDias,
  inicioSemana,
  finSemana,
  semanasCompletas,
  etiquetaSemanaIso,
  etiquetaMes,
  finMes,
  mesDeFecha,
  rangoContiene,
};

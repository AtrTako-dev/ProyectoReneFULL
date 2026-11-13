function aCentavos(valor, campo = 'importe') {
  let numero;
  if (typeof valor === 'string') {
    const limpio = valor.trim();
    if (!/^-?\d+(?:\.\d{1,2})?$/.test(limpio)) {
      throw new Error(`${campo} debe ser un número con máximo dos decimales.`);
    }
    numero = Number(limpio);
  } else if (typeof valor === 'number' && Number.isFinite(valor)) {
    numero = valor;
  } else {
    throw new Error(`${campo} debe ser un número finito.`);
  }

  const centavos = Math.round(numero * 100);
  if (Math.abs(numero * 100 - centavos) > 1e-7) {
    throw new Error(`${campo} debe tener como máximo dos decimales.`);
  }
  return centavos;
}

function desdeCentavos(centavos) {
  if (!Number.isSafeInteger(centavos)) {
    throw new Error('El importe en centavos no es un entero seguro.');
  }
  return (centavos / 100).toFixed(2);
}

function aNumero(centavos) {
  return Number(desdeCentavos(centavos));
}

function redondear2(numero) {
  return Math.round((numero + Number.EPSILON) * 100) / 100;
}

module.exports = {
  aCentavos,
  desdeCentavos,
  aNumero,
  redondear2,
};

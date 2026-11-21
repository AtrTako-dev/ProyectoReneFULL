export function decimalToScaledInteger(rawValue, { precision, scale, label = 'El valor' } = {}) {
  if (!Number.isInteger(precision) || precision < 1
    || !Number.isInteger(scale) || scale < 0 || scale > precision) {
    throw new TypeError('Se requiere una precisión decimal válida.');
  }

  const text = typeof rawValue === 'number'
    ? String(rawValue)
    : typeof rawValue === 'string' ? rawValue.trim() : '';
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match) throw new RangeError(`${label} debe ser un decimal válido.`);

  const [, sign, rawInteger, rawFraction = ''] = match;
  const integer = rawInteger.replace(/^0+(?=\d)/, '');
  if (integer.length > precision - scale) {
    throw new RangeError(`${label} excede el rango permitido.`);
  }
  if (rawFraction.length > scale && /[1-9]/.test(rawFraction.slice(scale))) {
    throw new RangeError(`${label} admite como máximo ${scale} decimales.`);
  }

  const factor = 10n ** BigInt(scale);
  const fraction = rawFraction.slice(0, scale).padEnd(scale, '0');
  const fractionalUnits = fraction ? BigInt(fraction) : 0n;
  const magnitude = (BigInt(integer) * factor) + fractionalUnits;
  return sign === '-' ? -magnitude : magnitude;
}

export function scaledIntegerToDecimal(value, scale) {
  const integer = typeof value === 'bigint' ? value : BigInt(value);
  const sign = integer < 0n ? '-' : '';
  const magnitude = integer < 0n ? -integer : integer;
  const factor = 10n ** BigInt(scale);
  const whole = magnitude / factor;
  if (scale === 0) return `${sign}${whole}`;
  const fraction = (magnitude % factor).toString().padStart(scale, '0');
  return `${sign}${whole}.${fraction}`;
}

export function scaledIntegerToNumber(value, scale) {
  return Number(value) / (10 ** scale);
}

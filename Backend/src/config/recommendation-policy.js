const DISCRETE_UNITS = new Set([
  'barra',
  'bolsa',
  'botella',
  'caja',
  'envase',
  'frasco',
  'juego',
  'lata',
  'paquete',
  'pieza',
]);

function ceilToPrecision(value, scale) {
  return Math.ceil((value * scale) - 1e-9) / scale;
}

export const DEMO_RECOMMENDATION_POLICY = Object.freeze({
  id: 'demo-basic-v1',
  name: 'Política básica de demostración',
  planningHorizonWeeks: 1,
  safetyStockRate: 0.2,
  excessStockMultiplier: 1.5,
  leadTimeWeeks: null,
  pendingOrdersIncluded: false,
  minimumOrderQuantity: null,
  perishabilityConsidered: false,
  assumptions: Object.freeze([
    'Cubre una semana de demanda pronosticada.',
    'Aplica un buffer nominal de 20% de seguridad y lo redondea hacia arriba según la unidad.',
    'No descuenta pedidos en tránsito.',
    'No considera plazo de entrega ni mínimos de compra.',
    'No considera caducidad o vida útil del producto.',
  ]),
});

export function isDiscreteUnit(unit) {
  const normalizedUnit = String(unit ?? '').trim().toLocaleLowerCase('es-MX');
  return DISCRETE_UNITS.has(normalizedUnit);
}

export function roundUpForUnit(value, unit) {
  return ceilToPrecision(value, isDiscreteUnit(unit) ? 1 : 1000);
}

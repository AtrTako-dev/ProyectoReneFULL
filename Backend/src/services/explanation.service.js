import { DEMO_RECOMMENDATION_POLICY } from '../config/recommendation-policy.js';
import { DomainError } from '../errors/domain-error.js';
import { RecommendationStatus } from '../models/recommendation.model.js';

const numberFormatter = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 3 });
const methodLabels = Object.freeze({
  'random-forest': 'Random Forest',
  'last-week': 'línea base de última semana',
  'moving-average-4': 'línea base de promedio de cuatro semanas',
});
const statusLabels = Object.freeze({
  [RecommendationStatus.BUY]: 'COMPRAR',
  [RecommendationStatus.HOLD]: 'MANTENER',
  [RecommendationStatus.NO_BUY]: 'NO_COMPRAR',
});

function formatAmount(value) {
  return numberFormatter.format(value);
}

function validateInputs({ forecast, inventory, recommendation } = {}) {
  if (!forecast || !inventory || !recommendation) {
    throw new DomainError('Se requieren pronóstico, inventario y recomendación para explicar el resultado.', {
      code: 'MISSING_EXPLANATION_INPUT',
    });
  }
}

function explanationDetails({ forecast, inventory, recommendation, events = [], calendarMetadata = null } = {}) {
  validateInputs({ forecast, inventory, recommendation });
  const unit = forecast.unit;
  const predictedDemand = recommendation.planningDemand;
  const currentStock = recommendation.currentStock;
  const targetStock = recommendation.targetStock;
  const safetyStock = recommendation.safetyStock;
  const suggestedReplenishment = recommendation.suggestedReplenishment;
  const excessStockMultiplier = recommendation.policy?.excessStockMultiplier
    ?? DEMO_RECOMMENDATION_POLICY.excessStockMultiplier;
  const statusLabel = statusLabels[recommendation.status];

  if (!statusLabel) {
    throw new DomainError('El estado de la recomendación no es válido.', {
      code: 'INVALID_RECOMMENDATION_STATUS',
    });
  }

  let reason;
  if (recommendation.status === RecommendationStatus.BUY) {
    reason = `El inventario está por debajo de la meta de ${formatAmount(targetStock)} ${unit}; se sugiere reponer ${formatAmount(suggestedReplenishment)} ${unit}.`;
  } else if (recommendation.status === RecommendationStatus.NO_BUY) {
    reason = `El inventario supera ${formatAmount(excessStockMultiplier)} veces la meta de ${formatAmount(targetStock)} ${unit}; no se sugiere una compra.`;
  } else {
    reason = `El inventario cubre la meta de ${formatAmount(targetStock)} ${unit} y no supera ${formatAmount(excessStockMultiplier)} veces esa cantidad; se mantiene el nivel actual.`;
  }

  const metrics = forecast.metrics?.selected ?? null;
  const method = methodLabels[forecast.metrics?.selectedMethod ?? forecast.modelName]
    ?? forecast.modelName;
  const metricText = metrics?.mae === null || metrics?.mae === undefined
    ? 'No hay métricas de validación disponibles para esta serie.'
    : `La validación temporal reportó MAE de ${formatAmount(metrics.mae)} ${unit}${metrics.wapePercent === null || metrics.wapePercent === undefined ? '' : ` y WAPE de ${formatAmount(metrics.wapePercent)}%`}.`;
  const sourceText = forecast.syntheticData
    ? 'El pronóstico usa datos sintéticos de demostración.'
    : `El origen del pronóstico es ${forecast.sourceOrigin ?? 'operativo'}.`;
  const assumptions = recommendation.policy?.assumptions ?? DEMO_RECOMMENDATION_POLICY.assumptions;
  const eventLabels = Array.isArray(events)
    ? [...new Set(events.map(event => event?.label).filter(label => typeof label === 'string' && label.trim()))]
    : [];
  const calendarVersion = calendarMetadata?.version
    ?? events.find(event => event?.calendarVersion)?.calendarVersion
    ?? null;
  const calendarText = eventLabels.length > 0
    ? ` El calendario ${calendarVersion ?? ''} muestra ${eventLabels.join(', ')} como referencia; no se interpreta como causa de cambios en la demanda.`
    : ` El calendario ${calendarVersion ?? 'de demostración'} no muestra eventos aplicables y no modifica el pronóstico.`;
  const summary = [
    `Recomendación: ${statusLabel}.`,
    `La demanda pronosticada es ${formatAmount(forecast.predictedDemand)} ${unit}; para planificar se redondea a ${formatAmount(predictedDemand)} ${unit}.`,
    `El inventario actual es ${formatAmount(currentStock)} ${unit}; la meta agrega ${formatAmount(safetyStock)} ${unit} de seguridad a partir de un buffer nominal de ${formatAmount(recommendation.policy?.safetyStockRate ?? DEMO_RECOMMENDATION_POLICY.safetyStockRate) * 100}%, redondeado según la unidad.`,
    reason,
    `Método: ${method}. ${metricText}`,
    sourceText,
    `Política ${recommendation.policy?.id ?? DEMO_RECOMMENDATION_POLICY.id}: ${assumptions.join(' ')}`,
    calendarText.trim(),
  ].join(' ');

  return {
    resumen: summary,
    recomendacion: {
      estado: statusLabel,
      cantidad_sugerida: suggestedReplenishment,
      unidad: unit,
    },
    demanda: {
      pronosticada: forecast.predictedDemand,
      para_planificacion: predictedDemand,
      semanas: forecast.horizonWeeks,
      unidad: unit,
    },
    inventario: {
      actual: currentStock,
      seguridad: safetyStock,
      objetivo: targetStock,
      cantidad_sugerida: suggestedReplenishment,
      unidad: unit,
    },
    politica: recommendation.policy ?? DEMO_RECOMMENDATION_POLICY,
    evidencia_pronostico: {
      metodo: method,
      metricas_validacion: metrics,
      fuente: forecast.sourceOrigin ?? null,
      sintetico: Boolean(forecast.syntheticData),
    },
    calendario: {
      version: calendarVersion,
      eventos: events.map(event => ({
        id: event.id,
        nombre: event.label,
        fecha_inicio: event.startDate,
        fecha_fin: event.endDate,
        fuente: event.source,
        version: event.calendarVersion,
      })),
      afecta_pronostico: false,
    },
    limitaciones: [...assumptions],
  };
}

export const explanationService = Object.freeze({
  explain(input = {}) {
    return explanationDetails(input).resumen;
  },

  explainDetails(input = {}) {
    return explanationDetails(input);
  },
});

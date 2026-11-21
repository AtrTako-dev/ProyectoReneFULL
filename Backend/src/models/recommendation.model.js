import { DomainError } from '../errors/domain-error.js';

export const RecommendationStatus = Object.freeze({
  BUY: 'BUY',
  HOLD: 'HOLD',
  NO_BUY: 'NO_BUY',
});

function validateAmount(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new DomainError(`${field} debe ser un número finito mayor o igual a cero.`, {
      code: 'INVALID_RECOMMENDATION_AMOUNT',
    });
  }
}

export class Recommendation {
  constructor({
    status,
    predictedDemand,
    planningDemand = predictedDemand,
    safetyStock,
    targetStock,
    currentStock,
    suggestedReplenishment,
    unit,
    horizonWeeks = 1,
    policy = null,
  } = {}) {
    if (!Object.values(RecommendationStatus).includes(status)) {
      throw new DomainError('El estado de la recomendación no es válido.', {
        code: 'INVALID_RECOMMENDATION_STATUS',
      });
    }
    for (const [field, value] of Object.entries({
      predictedDemand,
      planningDemand,
      safetyStock,
      targetStock,
      currentStock,
      suggestedReplenishment,
    })) {
      validateAmount(value, field);
    }
    if (typeof unit !== 'string' || unit.trim() === '') {
      throw new DomainError('La unidad de la recomendación es obligatoria.', {
        code: 'INVALID_RECOMMENDATION_UNIT',
      });
    }
    if (!Number.isSafeInteger(horizonWeeks) || horizonWeeks < 1) {
      throw new DomainError('El horizonte de la recomendación debe ser un entero positivo.', {
        code: 'INVALID_RECOMMENDATION_HORIZON',
      });
    }

    this.status = status;
    this.predictedDemand = predictedDemand;
    this.planningDemand = planningDemand;
    this.safetyStock = safetyStock;
    this.targetStock = targetStock;
    this.currentStock = currentStock;
    this.suggestedReplenishment = suggestedReplenishment;
    this.unit = unit;
    this.horizonWeeks = horizonWeeks;
    this.policy = policy && typeof policy === 'object'
      ? Object.freeze({
        ...policy,
        assumptions: Object.freeze([...(policy.assumptions ?? [])]),
      })
      : null;
    Object.freeze(this);
  }
}

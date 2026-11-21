import { DomainError } from '../errors/domain-error.js';
import { Recommendation, RecommendationStatus } from '../models/recommendation.model.js';
import {
  DEMO_RECOMMENDATION_POLICY,
  isDiscreteUnit,
  roundUpForUnit,
} from '../config/recommendation-policy.js';

function validateAmount(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new DomainError(`${label} debe ser un número finito mayor o igual a cero.`, {
      code: 'INVALID_QUANTITY',
    });
  }
}

export const recommendationService = Object.freeze({
  recommend({ forecast, inventory } = {}) {
    if (!forecast || typeof forecast !== 'object' || !inventory || typeof inventory !== 'object') {
      throw new DomainError('Se requieren un pronóstico y un inventario.', {
        code: 'MISSING_RECOMMENDATION_INPUT',
      });
    }

    const predictedDemand = forecast.predictedDemand;
    const currentStock = inventory.quantity;
    const forecastUnit = forecast.unit;
    const inventoryUnit = inventory.unit;

    validateAmount(predictedDemand, 'El pronóstico');
    validateAmount(currentStock, 'El inventario');

    if (typeof forecastUnit !== 'string' || forecastUnit === '') {
      throw new DomainError('El pronóstico debe indicar su unidad.', {
        code: 'INVALID_FORECAST_UNIT',
      });
    }
    if (forecastUnit !== inventoryUnit) {
      throw new DomainError('La unidad del pronóstico debe coincidir exactamente con la del inventario.', {
        code: 'UNIT_MISMATCH',
      });
    }
    if (isDiscreteUnit(inventoryUnit) && !Number.isInteger(currentStock)) {
      throw new DomainError('El inventario de una unidad de conteo debe ser entero.', {
        code: 'INVALID_DISCRETE_INVENTORY',
      });
    }
    if ((forecast.horizonWeeks ?? DEMO_RECOMMENDATION_POLICY.planningHorizonWeeks)
      !== DEMO_RECOMMENDATION_POLICY.planningHorizonWeeks) {
      throw new DomainError('La recomendación requiere un pronóstico de una semana.', {
        code: 'INVALID_FORECAST_HORIZON',
      });
    }

    const planningDemand = roundUpForUnit(predictedDemand, forecastUnit);
    const safetyStock = roundUpForUnit(
      planningDemand * DEMO_RECOMMENDATION_POLICY.safetyStockRate,
      forecastUnit,
    );
    const targetStock = roundUpForUnit(planningDemand + safetyStock, forecastUnit);
    let status = RecommendationStatus.HOLD;
    let suggestedReplenishment = 0;

    if (currentStock < targetStock) {
      status = RecommendationStatus.BUY;
      suggestedReplenishment = roundUpForUnit(targetStock - currentStock, forecastUnit);
    } else if (currentStock > targetStock * DEMO_RECOMMENDATION_POLICY.excessStockMultiplier) {
      status = RecommendationStatus.NO_BUY;
    }

    return new Recommendation({
      status,
      predictedDemand,
      planningDemand,
      safetyStock,
      targetStock,
      currentStock,
      suggestedReplenishment,
      unit: forecastUnit,
      horizonWeeks: DEMO_RECOMMENDATION_POLICY.planningHorizonWeeks,
      policy: DEMO_RECOMMENDATION_POLICY,
    });
  },
});

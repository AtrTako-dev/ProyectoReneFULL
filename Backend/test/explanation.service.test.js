import assert from 'node:assert/strict';
import { test } from 'node:test';
import { explanationService } from '../src/services/explanation.service.js';
import { recommendationService } from '../src/services/recommendation.service.js';

test('la explicación conserva el método del pronóstico en su evidencia', () => {
  const forecast = {
    predictedDemand: 4.2,
    horizonWeeks: 1,
    unit: 'pieza',
    modelName: 'last-week',
    metrics: null,
    sourceOrigin: 'synthetic',
    syntheticData: true,
  };
  const inventory = { quantity: 8, unit: 'pieza' };
  const recommendation = recommendationService.recommend({ forecast, inventory });

  const explanation = explanationService.explainDetails({
    forecast,
    inventory,
    recommendation,
    events: [],
    calendarMetadata: { version: 'demo-2026' },
  });

  assert.equal(explanation.evidencia_pronostico.metodo, 'línea base de última semana');
  assert.match(explanation.resumen, /Método: línea base de última semana/);
});

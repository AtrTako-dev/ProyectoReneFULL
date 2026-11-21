import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBusinessController } from '../src/controllers/business.controller.js';
import { DomainError } from '../src/errors/domain-error.js';
import { ForecastService } from '../src/services/forecast.service.js';

function controllerWith(forecastError) {
  return createBusinessController({
    authService: {},
    salesRepository: {
      getBusiness: () => ({ businessId: '201' }),
      getProduct: () => ({ productId: 'PS001' }),
    },
    forecastService: {
      forecast: () => {
        throw forecastError;
      },
    },
    inventoryService: {},
    recommendationService: {},
    explanationService: {},
    calendarService: {},
  });
}

const request = {
  params: { businessId: '201', productId: 'PS001' },
  query: {},
};

test('el controlador conserva errores inesperados del pronóstico para responder como error interno', async () => {
  const failure = new Error('fallo de inicialización del modelo');
  const controller = controllerWith(failure);

  await assert.rejects(controller.getForecast(request, {}), error => error === failure);
});

test('el controlador conserva el error tipado de historial insuficiente', async () => {
  const failure = new DomainError('Se requieren cuatro semanas consecutivas.', {
    status: 422,
    code: 'INSUFFICIENT_SALES_HISTORY',
  });
  const controller = controllerWith(failure);

  await assert.rejects(controller.getForecast(request, {}), error => error === failure);
});

test('el servicio distingue historial insuficiente como un error de dominio 422', async () => {
  const salesRepository = {
    getBusiness: () => ({ businessId: '201' }),
    getProduct: () => ({ productId: 'PS001', unit: 'pieza' }),
    getSeries: () => [],
  };
  const forecastService = new ForecastService(salesRepository, {
    datasetService: {
      build: () => ({
        series: [],
        examples: [],
        featureNames: [],
        encodings: {},
        sourceOrigin: 'synthetic',
      }),
    },
  });
  await forecastService.initialize();

  assert.throws(
    () => forecastService.forecast({ businessId: '201', productId: 'PS001' }),
    error => error instanceof DomainError
      && error.status === 422
      && error.code === 'INSUFFICIENT_SALES_HISTORY',
  );
});

test('el controlador publica las métricas finales de prueba y sus conteos separados', async () => {
  const metrics = { mae: 1, wapePercent: 10, observations: 10 };
  const businessMetric = {
    businessId: '201',
    businessName: 'Tienda de prueba',
    unit: 'pieza',
    selectedMethod: 'last-week',
    trainingObservations: 26,
    validationObservations: 10,
    testObservations: 10,
    testSampleIsSmall: true,
    validationMetrics: { selectedMethod: 'last-week', selected: metrics },
    testMetrics: { selectedMethod: 'last-week', selected: metrics },
  };
  const controller = createBusinessController({
    authService: {},
    salesRepository: { getBusiness: () => ({ businessId: '201' }) },
    forecastService: {
      getEvaluation: () => ({
        modelName: 'RandomForestRegression con selección por unidad',
        protocol: { trainRatio: 0.6, validationRatio: 0.2, testRatio: 0.2 },
        sourceOrigin: 'synthetic',
        syntheticData: true,
        trainingObservations: 26,
        validationObservations: 10,
        testObservations: 10,
        metricsByUnit: [],
        metricsByBusinessAndUnit: [businessMetric],
        perSeries: [{
          businessId: '201',
          productId: 'PS001',
          unit: 'pieza',
          status: 'evaluated',
          historyObservations: 50,
          trainingObservations: 26,
          validationObservations: 10,
          testObservations: 10,
          testSampleIsSmall: true,
          selectedMethod: 'last-week',
          selected: metrics,
          validationMetrics: businessMetric.validationMetrics,
          testMetrics: businessMetric.testMetrics,
          randomForest: null,
          lastWeek: metrics,
          movingAverage4: metrics,
        }],
      }),
    },
    inventoryService: {},
    recommendationService: {},
    explanationService: {},
    calendarService: {},
  });
  let responseBody;

  await controller.getModelEvaluation(
    { params: { businessId: '201' } },
    { json: body => { responseBody = body; } },
  );

  assert.equal(responseBody.observaciones_entrenamiento, 26);
  assert.equal(responseBody.observaciones_validacion, 10);
  assert.equal(responseBody.observaciones_prueba, 10);
  assert.equal(responseBody.observaciones_evaluadas, undefined);
  assert.deepEqual(responseBody.metricas_por_negocio_y_unidad, [businessMetric]);
  assert.equal(responseBody.series[0].observaciones_prueba, 10);
  assert.equal(responseBody.series[0].prueba_muestra_pequena, true);
  assert.deepEqual(responseBody.series[0].metricas_validacion, businessMetric.validationMetrics);
  assert.deepEqual(responseBody.series[0].metricas_prueba, businessMetric.testMetrics);
});

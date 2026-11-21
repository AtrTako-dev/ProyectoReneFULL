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

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DomainError } from '../src/errors/domain-error.js';
import { ForecastDatasetService } from '../src/services/forecast-dataset.service.js';
import { ForecastService } from '../src/services/forecast.service.js';
import {
  calculateForecastMetrics,
  chooseForecastMethod,
} from '../src/services/forecast-evaluation.js';

const BUSINESS_ID = '201';
const PRODUCT_ID = 'PS001';
const UNIT = 'pieza';

function salesFor(values) {
  const firstDate = new Date('2026-01-05T00:00:00.000Z');
  return values.map((unitsSold, index) => {
    const start = new Date(firstDate);
    start.setUTCDate(start.getUTCDate() + index * 7);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 6);
    return {
      businessId: BUSINESS_ID,
      productId: PRODUCT_ID,
      weekNumber: index + 1,
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      unitsSold,
      dataOrigin: 'operational',
    };
  });
}

function makeSalesRepository(values) {
  const sales = salesFor(values);
  const product = {
    businessId: BUSINESS_ID,
    productId: PRODUCT_ID,
    productName: 'Producto de prueba',
    unit: UNIT,
  };
  return {
    getBusinesses: () => [{ businessId: BUSINESS_ID, businessName: 'Negocio de prueba' }],
    getBusiness: businessId => businessId === BUSINESS_ID
      ? { businessId: BUSINESS_ID, businessName: 'Negocio de prueba' }
      : null,
    getProducts: businessId => businessId === BUSINESS_ID ? [{ ...product }] : [],
    getProduct: (businessId, productId) => businessId === BUSINESS_ID && productId === PRODUCT_ID
      ? { ...product }
      : null,
    getSeries: (businessId, productId) => businessId === BUSINESS_ID && productId === PRODUCT_ID
      ? sales.map(sale => ({ ...sale }))
      : [],
  };
}

function periodicDemandHistory(cycles = 16) {
  return Array.from({ length: cycles * 4 }, (_value, index) => (index % 4) + 1);
}

function inMemoryArtifactRepository() {
  let savedArtifact = null;
  return {
    find: async (modelKey, fingerprint) => (
      savedArtifact?.modelKey === modelKey && savedArtifact.dataFingerprint === fingerprint
        ? structuredClone(savedArtifact)
        : null
    ),
    save: async artifact => { savedArtifact = structuredClone(artifact); },
    getSavedArtifact: () => savedArtifact && structuredClone(savedArtifact),
  };
}

test('prepara las cuatro demandas previas y excluye la semana objetivo de sus features', () => {
  const dataset = new ForecastDatasetService().build(makeSalesRepository([2, 4, 6, 8, 999, 12]));
  const example = dataset.examples.find(item => item.targetIndex === 4);

  assert.equal(example.target, 999);
  assert.deepEqual(example.features, [5, 8, 6, 4, 2, 5, 1, 1]);
  assert.equal(example.features.includes(example.target), false);
});

test('divide las observaciones cronológicamente en entrenamiento, validación y prueba', () => {
  const dataset = new ForecastDatasetService().build(makeSalesRepository(
    Array.from({ length: 12 }, (_value, index) => index + 1),
  ));

  assert.deepEqual(
    dataset.examples.filter(item => item.split === 'train').map(item => item.targetIndex),
    [4, 5, 6],
  );
  assert.deepEqual(
    dataset.examples.filter(item => item.split === 'validation').map(item => item.targetIndex),
    [7, 8],
  );
  assert.deepEqual(
    dataset.examples.filter(item => item.split === 'test').map(item => item.targetIndex),
    [9, 10, 11],
  );
});

test('una serie de 50 semanas produce 26 ejemplos de entrenamiento, 10 de validación y 10 de prueba', () => {
  const dataset = new ForecastDatasetService().build(makeSalesRepository(
    Array.from({ length: 50 }, (_value, index) => index + 1),
  ));

  assert.deepEqual(
    Object.fromEntries(['train', 'validation', 'test'].map(split => [
      split,
      dataset.examples.filter(example => example.split === split).length,
    ])),
    { train: 26, validation: 10, test: 10 },
  );
});

test('comparte los cortes de fecha entre series de la misma unidad con inicios distintos', () => {
  const definitions = [
    { businessId: '201', productId: 'A001', firstDate: '2026-01-05' },
    { businessId: '202', productId: 'A002', firstDate: '2026-01-19' },
  ];
  const businesses = definitions.map(({ businessId }) => ({
    businessId,
    businessName: `Negocio ${businessId}`,
  }));
  const products = definitions.map(definition => ({
    ...definition,
    productName: `Producto ${definition.productId}`,
    unit: 'pieza',
  }));
  const histories = new Map(definitions.map(definition => {
    const firstDate = new Date(`${definition.firstDate}T00:00:00.000Z`);
    const values = Array.from({ length: 50 }, (_value, index) => index + 1);
    const history = salesFor(values).map((sale, index) => {
      const start = new Date(firstDate);
      start.setUTCDate(start.getUTCDate() + index * 7);
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 6);
      return {
        ...sale,
        businessId: definition.businessId,
        productId: definition.productId,
        startDate: start.toISOString().slice(0, 10),
        endDate: end.toISOString().slice(0, 10),
      };
    });
    return [`${definition.businessId}/${definition.productId}`, history];
  }));
  const repository = {
    getBusinesses: () => businesses,
    getProducts: businessId => products.filter(product => product.businessId === businessId),
    getSeries: (businessId, productId) => histories.get(`${businessId}/${productId}`) ?? [],
  };
  const dataset = new ForecastDatasetService().build(repository);
  const datesBySplit = Object.fromEntries(['train', 'validation', 'test'].map(split => [
    split,
    dataset.examples.filter(example => example.split === split).map(example => {
      const series = dataset.series.find(item => item.key === example.key);
      return series.history[example.targetIndex].startDate;
    }),
  ]));
  const lastTrainingDate = datesBySplit.train.sort().at(-1);
  const firstValidationDate = datesBySplit.validation.sort()[0];
  const lastValidationDate = datesBySplit.validation.at(-1);
  const firstTestDate = datesBySplit.test.sort()[0];

  assert.ok(lastTrainingDate < firstValidationDate);
  assert.ok(lastValidationDate < firstTestDate);
});

test('cambiar la demanda objetivo no filtra ese valor a sus propias features', () => {
  const values = Array.from({ length: 12 }, (_value, index) => index + 1);
  const changedValues = [...values];
  changedValues[9] = 10_000;
  const builder = new ForecastDatasetService();
  const original = builder.build(makeSalesRepository(values)).examples.find(item => item.targetIndex === 9);
  const changed = builder.build(makeSalesRepository(changedValues)).examples.find(item => item.targetIndex === 9);

  assert.notEqual(changed.target, original.target);
  assert.deepEqual(changed.features, original.features);
});

test('el modelo entrenado produce métricas y pronósticos finitos no negativos', async () => {
  const service = new ForecastService(makeSalesRepository(periodicDemandHistory()));
  await service.initialize();

  const evaluation = service.getEvaluation();
  const randomForestMetrics = evaluation.metricsByUnit[0].metrics.randomForest;
  const forecast = service.forecast({ businessId: BUSINESS_ID, productId: PRODUCT_ID });

  assert.ok(randomForestMetrics);
  assert.ok(Number.isFinite(randomForestMetrics.mae));
  assert.ok(randomForestMetrics.mae >= 0);
  assert.ok(forecast.weeklyPredictions.every(item => Number.isFinite(item.demanda) && item.demanda >= 0));
  assert.ok(Number.isFinite(forecast.predictedDemand) && forecast.predictedDemand >= 0);
});

test('selecciona con validación y reporta métricas solo con la prueba sin entrenar en ella', async () => {
  const originalValues = periodicDemandHistory(13).slice(0, 50);
  const changedValues = [...originalValues];
  changedValues[40] = 1000;

  const originalArtifacts = inMemoryArtifactRepository();
  const originalService = new ForecastService(makeSalesRepository(originalValues), {
    artifactRepository: originalArtifacts,
  });
  const changedService = new ForecastService(makeSalesRepository(changedValues));
  await originalService.initialize();
  await changedService.initialize();

  const original = originalService.getEvaluation();
  const changed = changedService.getEvaluation();
  const originalUnit = original.metricsByUnit.find(item => item.unit === UNIT);
  const changedUnit = changed.metricsByUnit.find(item => item.unit === UNIT);
  const originalSeries = original.perSeries[0];

  assert.equal(originalUnit.trainingObservations, 26);
  assert.equal(originalUnit.validationObservations, 10);
  assert.equal(originalUnit.testObservations, 10);
  assert.equal(originalUnit.testModelTrainingObservations, 36);
  assert.equal(originalUnit.validationMetrics.selectedMethod, originalUnit.selectedMethod);
  assert.equal(originalUnit.testMetrics.selected.observations, 10);
  assert.deepEqual(changedUnit.validationMetrics, originalUnit.validationMetrics);
  assert.equal(changedUnit.selectedMethod, originalUnit.selectedMethod);
  assert.notDeepEqual(changedUnit.testMetrics, originalUnit.testMetrics);
  assert.equal(originalSeries.trainingObservations, 26);
  assert.equal(originalSeries.validationObservations, 10);
  assert.equal(originalSeries.testObservations, 10);
  assert.equal(originalSeries.testSampleIsSmall, true);
  assert.equal(originalSeries.selected.observations, 10);
  assert.equal(originalSeries.testMetrics.selected.observations, 10);
  const savedUnitModel = originalArtifacts.getSavedArtifact().unitModels[0];
  assert.equal(savedUnitModel.trainingObservations, 26);
  assert.equal(savedUnitModel.validationObservations, 10);
  assert.equal(savedUnitModel.testObservations, 10);
  assert.equal(savedUnitModel.deploymentTrainingObservations,
    savedUnitModel.selectedMethod === 'random-forest' ? 46 : 0);
});

test('resume métricas por negocio y unidad sin combinar unidades distintas', async () => {
  const businesses = [
    { businessId: '201', businessName: 'Tienda A' },
    { businessId: '202', businessName: 'Tienda B' },
  ];
  const products = [
    { businessId: '201', productId: 'K001', productName: 'Harina', unit: 'kg' },
    { businessId: '201', productId: 'P001', productName: 'Pan', unit: 'pieza' },
    { businessId: '202', productId: 'K002', productName: 'Arroz', unit: 'kg' },
  ];
  const histories = new Map(products.map(product => [
    `${product.businessId}/${product.productId}`,
    salesFor(Array.from({ length: 50 }, (_value, index) => (index % 7) + 1))
      .map(sale => ({ ...sale, businessId: product.businessId, productId: product.productId })),
  ]));
  const repository = {
    getBusinesses: () => businesses,
    getBusiness: businessId => businesses.find(business => business.businessId === businessId) ?? null,
    getProducts: businessId => products.filter(product => product.businessId === businessId),
    getProduct: (businessId, productId) => products.find(product => (
      product.businessId === businessId && product.productId === productId
    )) ?? null,
    getSeries: (businessId, productId) => histories.get(`${businessId}/${productId}`) ?? [],
  };
  const service = new ForecastService(repository);
  await service.initialize();

  const evaluation = service.getEvaluation();

  assert.deepEqual(
    evaluation.metricsByBusinessAndUnit.map(item => [item.businessId, item.unit, item.testObservations]),
    [['201', 'kg', 10], ['201', 'pieza', 10], ['202', 'kg', 10]],
  );
  assert.deepEqual(
    evaluation.metricsByUnit.map(item => [item.unit, item.testObservations]),
    [['kg', 20], ['pieza', 10]],
  );
  assert.ok(evaluation.metricsByBusinessAndUnit.every(item => (
    item.testMetrics.selected.wapePercent === null
      || Number.isFinite(item.testMetrics.selected.wapePercent)
  )));
});

test('calcula MAE y WAPE sobre demanda no nula', () => {
  const metrics = calculateForecastMetrics([10, 11, 12], [9, 10, 11]);

  assert.equal(metrics.mae, 1);
  assert.equal(Number(metrics.wapePercent.toFixed(4)), 9.0909);
  assert.equal(metrics.observations, 3);
});

test('marca WAPE como no definido cuando la suma absoluta de demanda es cero', () => {
  const metrics = calculateForecastMetrics([0, 0], [1, 1]);

  assert.equal(metrics.mae, 1);
  assert.equal(metrics.wapePercent, null);
});

test('guardar y cargar el artefacto conserva las predicciones del Random Forest', async () => {
  const repository = makeSalesRepository(periodicDemandHistory());
  const artifactRepository = inMemoryArtifactRepository();
  const trainedService = new ForecastService(repository, { artifactRepository });
  await trainedService.initialize();
  const savedArtifact = artifactRepository.getSavedArtifact();
  const unitEvaluation = trainedService.getEvaluation().metricsByUnit[0];
  const trainedForecast = trainedService.forecast({ businessId: BUSINESS_ID, productId: PRODUCT_ID });

  assert.equal(savedArtifact.unitModels[0].selectedMethod, 'random-forest');
  assert.ok(savedArtifact.unitModels[0].randomForest);
  assert.equal(unitEvaluation.trainingObservations, 34);
  assert.equal(unitEvaluation.validationObservations, 13);
  assert.equal(unitEvaluation.testObservations, 13);
  assert.equal(unitEvaluation.testModelTrainingObservations, 47);
  assert.equal(savedArtifact.unitModels[0].deploymentTrainingObservations, 60);

  const loadedService = new ForecastService(repository, { artifactRepository });
  await loadedService.initialize();
  const loadedForecast = loadedService.forecast({ businessId: BUSINESS_ID, productId: PRODUCT_ID });

  assert.deepEqual(loadedForecast, trainedForecast);
});

test('distingue un producto desconocido de un historial menor a cuatro semanas', async () => {
  const fullHistoryService = new ForecastService(makeSalesRepository([1, 2, 3, 4]));
  await fullHistoryService.initialize();
  assert.throws(
    () => fullHistoryService.forecast({ businessId: BUSINESS_ID, productId: 'DESCONOCIDO' }),
    error => !(error instanceof DomainError) && /No existe el producto/.test(error.message),
  );

  const shortHistoryService = new ForecastService(makeSalesRepository([1, 2, 3]));
  await shortHistoryService.initialize();
  assert.throws(
    () => shortHistoryService.forecast({ businessId: BUSINESS_ID, productId: PRODUCT_ID }),
    error => error instanceof DomainError
      && error.status === 422
      && error.code === 'INSUFFICIENT_SALES_HISTORY',
  );
});

test('selecciona Random Forest solo si supera ambas líneas base por MAE', () => {
  assert.deepEqual(chooseForecastMethod({
    randomForestMetrics: { mae: 1 },
    lastWeekMetrics: { mae: 2 },
    movingAverage4Metrics: { mae: 3 },
  }), {
    baselineMethod: 'last-week',
    selectedMethod: 'random-forest',
  });

  assert.deepEqual(chooseForecastMethod({
    randomForestMetrics: { mae: 3 },
    lastWeekMetrics: { mae: 2 },
    movingAverage4Metrics: { mae: 6 },
  }), {
    baselineMethod: 'last-week',
    selectedMethod: 'last-week',
  });

  assert.deepEqual(chooseForecastMethod({
    randomForestMetrics: { mae: 3 },
    lastWeekMetrics: { mae: 6 },
    movingAverage4Metrics: { mae: 2 },
  }), {
    baselineMethod: 'moving-average-4',
    selectedMethod: 'moving-average-4',
  });

  assert.deepEqual(chooseForecastMethod({
    randomForestMetrics: { mae: 2 },
    lastWeekMetrics: { mae: 2 },
    movingAverage4Metrics: { mae: 4 },
  }), {
    baselineMethod: 'last-week',
    selectedMethod: 'last-week',
  });
});

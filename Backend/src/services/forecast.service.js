import { createHash } from 'node:crypto';
import { RandomForestRegression } from 'ml-random-forest';
import { DomainError } from '../errors/domain-error.js';
import { calculateForecastMetrics, chooseForecastMethod } from './forecast-evaluation.js';
import { ForecastDatasetService } from './forecast-dataset.service.js';

const MODEL_KEY = 'weekly-demand-forecast-v1';
const MODEL_VERSION = '2.2.0';
const TRAIN_RATIO = 0.6;
const VALIDATION_RATIO = 0.2;
const LAG_WEEKS = 4;
const SMALL_TEST_SAMPLE_THRESHOLD = 30;
const WEEK_MILLISECONDS = 7 * 24 * 60 * 60 * 1000;
const RANDOM_FOREST_OPTIONS = Object.freeze({
  nEstimators: 4,
  maxFeatures: 0.7,
  replacement: false,
  useSampleBagging: true,
  noOOB: true,
  treeOptions: { maxDepth: 5, minNumSamples: 5 },
});

function seriesKey(businessId, productId) {
  return `${String(businessId)}\u001f${String(productId)}`;
}

function roundMetric(value) {
  return value === null || value === undefined ? null : Number(value.toFixed(4));
}

function publicMetrics(metrics) {
  if (!metrics) return null;
  return {
    mae: roundMetric(metrics.mae),
    wapePercent: roundMetric(metrics.wapePercent),
    observations: metrics.observations,
  };
}

function predictNonNegative(model, features) {
  const prediction = model.predict([features])[0];
  return Number.isFinite(prediction) ? Math.max(0, prediction) : 0;
}

function predictBatchNonNegative(model, examples) {
  return model.predict(examples.map(example => example.features))
    .map(prediction => Number.isFinite(prediction) ? Math.max(0, prediction) : 0);
}

function baselinePrediction(example, method) {
  if (method === 'last-week') return example.features[1];
  return example.features[5];
}

function metricsForPredictions(rows) {
  const calculate = key => {
    if (rows.length === 0 || rows.some(row => !Number.isFinite(row[key]))) return null;
    return calculateForecastMetrics(
      rows.map(row => row.actual),
      rows.map(row => row[key]),
    );
  };
  return {
    randomForest: calculate('randomForest'),
    lastWeek: calculate('lastWeek'),
    movingAverage4: calculate('movingAverage4'),
  };
}

function selectedMetricKey(method) {
  if (method === 'random-forest') return 'randomForest';
  if (method === 'moving-average-4') return 'movingAverage4';
  return 'lastWeek';
}

function publicMetricSet(metrics, selectedMethod) {
  return {
    selectedMethod,
    selected: publicMetrics(metrics[selectedMetricKey(selectedMethod)]),
    randomForest: publicMetrics(metrics.randomForest),
    lastWeek: publicMetrics(metrics.lastWeek),
    movingAverage4: publicMetrics(metrics.movingAverage4),
  };
}

function testSampleIsSmall(observations) {
  return observations < SMALL_TEST_SAMPLE_THRESHOLD;
}

function seedForUnit(unit) {
  return createHash('sha256').update(String(unit)).digest().readUInt32BE(0);
}

function dataFingerprint(dataset) {
  const canonicalData = dataset.series.map(item => ({
    businessId: item.businessId,
    productId: item.productId,
    unit: item.unit,
    history: item.history.map(sale => [
      sale.startDate,
      sale.endDate,
      Number(sale.unitsSold),
      sale.dataOrigin ?? 'synthetic',
    ]),
  }));
  return createHash('sha256').update(JSON.stringify(canonicalData)).digest('hex');
}

function addWeeks(dateString, count) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + (count * 7));
  return date.toISOString().slice(0, 10);
}

function consecutiveWeeks(history) {
  if (history.length < LAG_WEEKS) return false;
  for (let index = history.length - LAG_WEEKS + 1; index < history.length; index += 1) {
    const previous = Date.parse(`${history[index - 1].startDate}T00:00:00Z`);
    const current = Date.parse(`${history[index].startDate}T00:00:00Z`);
    if (current - previous !== WEEK_MILLISECONDS) return false;
  }
  return true;
}

function serializeUnitModel(unitModel) {
  return {
    unit: unitModel.unit,
    selectedMethod: unitModel.selectedMethod,
    randomForest: unitModel.randomForest?.toJSON() ?? null,
    metrics: unitModel.metrics,
    trainingObservations: unitModel.trainingObservations,
    validationObservations: unitModel.validationObservations,
    testObservations: unitModel.testObservations,
    deploymentTrainingObservations: unitModel.deploymentTrainingObservations,
  };
}

export class ForecastService {
  constructor(salesRepository, {
    artifactRepository = null,
    datasetService = new ForecastDatasetService(),
  } = {}) {
    if (!salesRepository) throw new TypeError('ForecastService requiere un repositorio de ventas.');
    this.salesRepository = salesRepository;
    this.artifactRepository = artifactRepository;
    this.datasetService = datasetService;
    this.unitModels = new Map();
    this.seriesEvaluations = new Map();
    this.dataset = null;
    this.evaluation = null;
    this.artifact = null;
  }

  async initialize() {
    const dataset = this.datasetService.build(this.salesRepository, {
      trainRatio: TRAIN_RATIO,
      validationRatio: VALIDATION_RATIO,
    });
    const fingerprint = dataFingerprint(dataset);
    let artifact = await this.artifactRepository?.find(MODEL_KEY, fingerprint);

    if (artifact && !this.#canLoadArtifact(artifact, dataset, fingerprint)) artifact = null;
    if (artifact) {
      try {
        this.#loadArtifact(artifact, dataset);
        return this.getEvaluation();
      } catch {
        artifact = null;
      }
    }

    artifact = this.#trainArtifact(dataset, fingerprint);
    if (this.artifactRepository && artifact.unitModels.length > 0) {
      await this.artifactRepository.save(artifact);
    }
    this.#loadArtifact(artifact, dataset);
    return this.getEvaluation();
  }

  #canLoadArtifact(artifact, dataset, fingerprint) {
    return artifact?.modelKey === MODEL_KEY
      && artifact?.modelVersion === MODEL_VERSION
      && artifact?.dataFingerprint === fingerprint
      && JSON.stringify(artifact.featureNames) === JSON.stringify(dataset.featureNames)
      && Array.isArray(artifact.unitModels)
      && artifact.evaluation !== undefined;
  }

  #trainArtifact(dataset, fingerprint) {
    const examplesByUnit = new Map();
    for (const example of dataset.examples) {
      if (!examplesByUnit.has(example.unit)) examplesByUnit.set(example.unit, []);
      examplesByUnit.get(example.unit).push(example);
    }

    const unitEvaluations = [];
    const unitModels = [];
    const seriesEvaluations = new Map();
    const predictionsBySeries = new Map(dataset.series.map(item => [item.key, {
      validation: [],
      test: [],
    }]));
    let totalTestObservations = 0;

    for (const [unit, unitExamples] of examplesByUnit) {
      const trainingExamples = unitExamples.filter(example => example.split === 'train');
      const validationExamples = unitExamples.filter(example => example.split === 'validation');
      const testExamples = unitExamples.filter(example => example.split === 'test');
      let selectionModel = null;
      let validationRandomForestPredictions = [];

      if (trainingExamples.length >= 10) {
        selectionModel = new RandomForestRegression({
          ...RANDOM_FOREST_OPTIONS,
          seed: seedForUnit(unit),
        });
        selectionModel.train(
          trainingExamples.map(example => example.features),
          trainingExamples.map(example => example.target),
        );
        if (validationExamples.length > 0) {
          validationRandomForestPredictions = predictBatchNonNegative(selectionModel, validationExamples);
        }
      }

      const validationRows = validationExamples.map((example, index) => ({
        actual: example.target,
        randomForest: validationRandomForestPredictions[index] ?? null,
        lastWeek: baselinePrediction(example, 'last-week'),
        movingAverage4: baselinePrediction(example, 'moving-average-4'),
      }));
      const validationMetricsRaw = metricsForPredictions(validationRows);
      const { baselineMethod, selectedMethod } = chooseForecastMethod({
        randomForestMetrics: validationMetricsRaw.randomForest,
        lastWeekMetrics: validationMetricsRaw.lastWeek,
        movingAverage4Metrics: validationMetricsRaw.movingAverage4,
      });
      const validationMetrics = publicMetricSet(validationMetricsRaw, selectedMethod);

      const testModelTrainingExamples = [...trainingExamples, ...validationExamples];
      let testModel = null;
      let testModelTrainingObservations = 0;
      let testRandomForestPredictions = [];
      if (testModelTrainingExamples.length >= 10 && testExamples.length > 0) {
        testModel = new RandomForestRegression({
          ...RANDOM_FOREST_OPTIONS,
          seed: seedForUnit(unit),
        });
        testModel.train(
          testModelTrainingExamples.map(example => example.features),
          testModelTrainingExamples.map(example => example.target),
        );
        testModelTrainingObservations = testModelTrainingExamples.length;
        testRandomForestPredictions = predictBatchNonNegative(testModel, testExamples);
      }

      const testRows = testExamples.map((example, index) => ({
        actual: example.target,
        randomForest: testRandomForestPredictions[index] ?? null,
        lastWeek: baselinePrediction(example, 'last-week'),
        movingAverage4: baselinePrediction(example, 'moving-average-4'),
      }));
      const testMetricsRaw = metricsForPredictions(testRows);
      const testMetrics = publicMetricSet(testMetricsRaw, selectedMethod);
      const metrics = {
        ...testMetrics,
        baselineMethod,
      };

      const deploymentModel = selectedMethod === 'random-forest' && unitExamples.length > 0
        ? new RandomForestRegression({
          ...RANDOM_FOREST_OPTIONS,
          seed: seedForUnit(unit),
        })
        : null;
      if (deploymentModel) {
        deploymentModel.train(
          unitExamples.map(example => example.features),
          unitExamples.map(example => example.target),
        );
      }

      for (const [index, example] of validationExamples.entries()) {
        predictionsBySeries.get(example.key).validation.push(validationRows[index]);
      }
      for (const [index, example] of testExamples.entries()) {
        predictionsBySeries.get(example.key).test.push(testRows[index]);
      }

      totalTestObservations += testExamples.length;
      unitEvaluations.push({
        unit,
        selectedMethod,
        trainingObservations: trainingExamples.length,
        validationObservations: validationExamples.length,
        testObservations: testExamples.length,
        testModelTrainingObservations,
        testSampleIsSmall: testSampleIsSmall(testExamples.length),
        validationMetrics,
        testMetrics,
        metrics,
      });
      unitModels.push({
        unit,
        selectedMethod,
        randomForest: deploymentModel,
        metrics,
        trainingObservations: trainingExamples.length,
        validationObservations: validationExamples.length,
        testObservations: testExamples.length,
        deploymentTrainingObservations: deploymentModel ? unitExamples.length : 0,
      });
    }

    const perSeries = dataset.series.map(item => {
      const predictions = predictionsBySeries.get(item.key) ?? { validation: [], test: [] };
      const unitModel = unitModels.find(model => model.unit === item.unit);
      const counts = Object.fromEntries(['train', 'validation', 'test'].map(split => [
        split,
        item.examples.filter(example => example.split === split).length,
      ]));
      const selectedMethod = unitModel?.selectedMethod ?? null;
      const validationMetrics = publicMetricSet(
        metricsForPredictions(predictions.validation),
        selectedMethod,
      );
      const testMetrics = publicMetricSet(
        metricsForPredictions(predictions.test),
        selectedMethod,
      );
      const result = {
        selectedMethod: unitModel ? selectedMethod : null,
        validationMetrics,
        testMetrics,
        selected: testMetrics.selected,
        randomForest: testMetrics.randomForest,
        lastWeek: testMetrics.lastWeek,
        movingAverage4: testMetrics.movingAverage4,
        historyObservations: item.history.length,
        trainingObservations: counts.train,
        validationObservations: counts.validation,
        testObservations: counts.test,
        testSampleIsSmall: testSampleIsSmall(counts.test),
      };
      seriesEvaluations.set(item.key, result);
      return {
        businessId: item.businessId,
        businessName: item.businessName,
        productId: item.productId,
        unit: item.unit,
        status: counts.test > 0 ? 'evaluated' : 'insufficient-test-data',
        ...result,
      };
    });

    const businessUnitGroups = new Map();
    for (const item of dataset.series) {
      const key = `${item.businessId}\u001f${item.unit}`;
      if (!businessUnitGroups.has(key)) {
        businessUnitGroups.set(key, {
          businessId: item.businessId,
          businessName: item.businessName,
          unit: item.unit,
          trainingObservations: 0,
          validationObservations: 0,
          testObservations: 0,
          validationRows: [],
          testRows: [],
        });
      }
      const group = businessUnitGroups.get(key);
      for (const example of item.examples) {
        if (example.split === 'train') group.trainingObservations += 1;
        else if (example.split === 'validation') group.validationObservations += 1;
        else group.testObservations += 1;
      }
      const predictions = predictionsBySeries.get(item.key);
      group.validationRows.push(...predictions.validation);
      group.testRows.push(...predictions.test);
    }

    const unitModelByName = new Map(unitModels.map(model => [model.unit, model]));
    const metricsByBusinessAndUnit = [...businessUnitGroups.values()].map(group => {
      const selectedMethod = unitModelByName.get(group.unit)?.selectedMethod ?? null;
      const validationMetrics = publicMetricSet(
        metricsForPredictions(group.validationRows),
        selectedMethod,
      );
      const testMetrics = publicMetricSet(
        metricsForPredictions(group.testRows),
        selectedMethod,
      );
      return {
        businessId: group.businessId,
        businessName: group.businessName,
        unit: group.unit,
        selectedMethod,
        trainingObservations: group.trainingObservations,
        validationObservations: group.validationObservations,
        testObservations: group.testObservations,
        testSampleIsSmall: testSampleIsSmall(group.testObservations),
        validationMetrics,
        testMetrics,
        metrics: testMetrics,
      };
    });

    const totalTrainingObservations = dataset.examples.filter(example => example.split === 'train').length;
    const totalValidationObservations = dataset.examples.filter(example => example.split === 'validation').length;

    return {
      modelKey: MODEL_KEY,
      modelVersion: MODEL_VERSION,
      trainedAt: new Date().toISOString(),
      dataFingerprint: fingerprint,
      sourceOrigin: dataset.sourceOrigin,
      featureNames: dataset.featureNames,
      encodings: dataset.encodings,
      unitModels: unitModels.map(serializeUnitModel),
      evaluation: {
        protocol: {
          split: 'chronological-by-unit-calendar-date',
          trainRatio: TRAIN_RATIO,
          validationRatio: VALIDATION_RATIO,
          testRatio: 1 - TRAIN_RATIO - VALIDATION_RATIO,
          featureWindowWeeks: LAG_WEEKS,
          target: 'units_sold',
          selectionMetric: 'MAE de validación por unidad; Random Forest se selecciona solo si supera ambas líneas base.',
          testMetric: 'MAE y WAPE se calculan exclusivamente con observaciones de prueba.',
          testPredictionProtocol: 'Evaluación rodante de un paso: cada predicción usa las cuatro ventas reales previas; nunca incluye la venta objetivo.',
          testModelTraining: 'El modelo evaluado en prueba se entrena con entrenamiento y validación; el modelo de despliegue se reentrena con todo el histórico al cambiar la huella de datos.',
          smallTestSampleThreshold: SMALL_TEST_SAMPLE_THRESHOLD,
          smallTestSampleThresholdNote: 'El corte de 30 es una etiqueta operativa de este proyecto y no una regla estadística universal.',
          limitations: ['Con historiales alineados de unas 50 semanas, cada serie aporta 10 observaciones de prueba; con fechas o longitudes distintas, el conteo por serie varía. En ambos casos, el tramo es limitado y no cubre un ciclo anual semanal.'],
          baselines: ['last-week', 'moving-average-4'],
        },
        modelName: 'RandomForestRegression con selección por unidad',
        sourceOrigin: dataset.sourceOrigin,
        syntheticData: dataset.sourceOrigin !== 'operational',
        seriesCount: dataset.series.length,
        evaluatedSeriesCount: perSeries.filter(item => item.status === 'evaluated').length,
        trainingObservations: totalTrainingObservations,
        validationObservations: totalValidationObservations,
        testObservations: totalTestObservations,
        metricsByUnit: unitEvaluations,
        metricsByBusinessAndUnit,
        perSeries,
      },
    };
  }

  #loadArtifact(artifact, dataset) {
    this.unitModels = new Map(artifact.unitModels.map(item => [item.unit, {
      ...item,
      randomForest: item.randomForest ? RandomForestRegression.load(item.randomForest) : null,
    }]));
    this.seriesEvaluations = new Map(
      artifact.evaluation.perSeries.map(item => [seriesKey(item.businessId, item.productId), item]),
    );
    this.dataset = {
      featureNames: dataset.featureNames,
      encodings: dataset.encodings,
      sourceOrigin: dataset.sourceOrigin,
    };
    this.evaluation = artifact.evaluation;
    this.artifact = artifact;
  }

  getEvaluation() {
    if (!this.evaluation) throw new Error('ForecastService no se ha inicializado.');
    return structuredClone(this.evaluation);
  }

  forecast({ businessId, productId, horizonWeeks = 1 }) {
    if (!this.evaluation || !this.dataset) throw new Error('ForecastService no se ha inicializado.');
    if (!Number.isSafeInteger(horizonWeeks) || horizonWeeks < 1) {
      throw new RangeError('horizonWeeks debe ser un entero positivo.');
    }

    const businessKey = String(businessId ?? '');
    const productKey = String(productId ?? '');
    const business = this.salesRepository.getBusiness(businessKey);
    if (!business) throw new Error(`No existe el negocio ${businessKey || '(vacío)'}.`);
    const product = this.salesRepository.getProduct(businessKey, productKey);
    if (!product) throw new Error(`No existe el producto ${productKey || '(vacío)'} en el surtido.`);

    const history = this.salesRepository.getSeries(businessKey, productKey)
      .sort((left, right) => left.startDate.localeCompare(right.startDate));
    if (!consecutiveWeeks(history)) {
      throw new DomainError('Se requieren cuatro semanas consecutivas para pronosticar.', {
        status: 422,
        code: 'INSUFFICIENT_SALES_HISTORY',
      });
    }

    const unitModel = this.unitModels.get(product.unit);
    if (!unitModel) throw new Error(`No hay un modelo disponible para la unidad ${product.unit}.`);
    let priorSales = history.map(sale => ({
      startDate: sale.startDate,
      unitsSold: Number(sale.unitsSold),
    }));
    const firstDate = history[0].startDate;
    const lastDate = history.at(-1).startDate;
    let predictedDemand = 0;
    const weeklyPredictions = [];

    for (let offset = 1; offset <= horizonWeeks; offset += 1) {
      const nextStartDate = addWeeks(lastDate, offset);
      const weeksSinceStart = Math.round(
        (Date.parse(`${nextStartDate}T00:00:00Z`) - Date.parse(`${firstDate}T00:00:00Z`)) / WEEK_MILLISECONDS,
      ) + 1;
      let prediction;
      if (unitModel.selectedMethod === 'random-forest' && unitModel.randomForest) {
        const features = this.datasetService.makeFutureFeatures({
          businessId: businessKey,
          productId: productKey,
          history: priorSales,
          weeksSinceStart,
        }, this.dataset.encodings);
        if (!features) throw new Error('El historial no contiene cuatro semanas consecutivas para el modelo.');
        prediction = predictNonNegative(unitModel.randomForest, features);
      } else if (unitModel.selectedMethod === 'moving-average-4') {
        prediction = priorSales.slice(-LAG_WEEKS)
          .reduce((sum, sale) => sum + sale.unitsSold, 0) / LAG_WEEKS;
      } else {
        prediction = priorSales.at(-1).unitsSold;
      }

      prediction = Math.max(0, prediction);
      predictedDemand += prediction;
      weeklyPredictions.push({
        semana: offset,
        fecha_inicio: nextStartDate,
        demanda: Number(prediction.toFixed(2)),
      });
      priorSales = [...priorSales, { startDate: nextStartDate, unitsSold: prediction }];
    }

    const metrics = this.seriesEvaluations.get(seriesKey(businessKey, productKey)) ?? null;
    return {
      businessId: businessKey,
      productId: productKey,
      productName: product.productName,
      unit: product.unit,
      horizonWeeks,
      predictedDemand: Number(predictedDemand.toFixed(2)),
      weeklyPredictions,
      modelName: unitModel.selectedMethod,
      metrics,
      sourceOrigin: this.dataset.sourceOrigin,
      syntheticData: this.dataset.sourceOrigin !== 'operational',
      historyPoints: history.map(sale => ({
        week: sale.weekNumber,
        date: sale.startDate,
        demand: sale.unitsSold,
      })),
      lastWeek: {
        week: history.at(-1).weekNumber,
        startDate: history.at(-1).startDate,
        endDate: history.at(-1).endDate,
        unitsSold: history.at(-1).unitsSold,
      },
    };
  }
}

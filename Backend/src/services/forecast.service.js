import { createHash } from 'node:crypto';
import { RandomForestRegression } from 'ml-random-forest';
import { DomainError } from '../errors/domain-error.js';
import { ForecastDatasetService } from './forecast-dataset.service.js';

const MODEL_KEY = 'weekly-demand-forecast-v1';
const MODEL_VERSION = '1.0.0';
const TRAIN_RATIO = 0.8;
const LAG_WEEKS = 4;
const WEEK_MILLISECONDS = 7 * 24 * 60 * 60 * 1000;
const RANDOM_FOREST_OPTIONS = Object.freeze({
  nEstimators: 80,
  maxFeatures: 0.7,
  replacement: false,
  useSampleBagging: true,
  treeOptions: { maxDepth: 5, minNumSamples: 5 },
});

function seriesKey(businessId, productId) {
  return `${String(businessId)}\u001f${String(productId)}`;
}

function roundMetric(value) {
  return value === null || value === undefined ? null : Number(value.toFixed(4));
}

function calculateMetrics(actualValues, predictedValues) {
  if (actualValues.length === 0) return null;
  let errorSum = 0;
  let actualMagnitude = 0;
  for (let index = 0; index < actualValues.length; index += 1) {
    errorSum += Math.abs(actualValues[index] - predictedValues[index]);
    actualMagnitude += Math.abs(actualValues[index]);
  }
  return {
    mae: errorSum / actualValues.length,
    wapePercent: actualMagnitude === 0 ? null : (errorSum / actualMagnitude) * 100,
    observations: actualValues.length,
  };
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

function bestBaseline(metrics) {
  if (!metrics.lastWeek) return 'last-week';
  if (!metrics.movingAverage4) return 'last-week';
  return metrics.movingAverage4.mae < metrics.lastWeek.mae
    ? 'moving-average-4'
    : 'last-week';
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
    holdoutObservations: unitModel.holdoutObservations,
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
    const dataset = this.datasetService.build(this.salesRepository, { trainRatio: TRAIN_RATIO });
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
    const testPredictions = new Map();
    let totalHoldoutObservations = 0;

    for (const [unit, unitExamples] of examplesByUnit) {
      const trainingExamples = unitExamples.filter(example => example.split === 'train');
      const holdoutExamples = unitExamples.filter(example => example.split === 'holdout');
      const trainingValues = trainingExamples.map(example => example.target);
      let evaluationModel = null;
      let evaluationPredictions = [];

      if (trainingExamples.length >= 10) {
        evaluationModel = new RandomForestRegression({
          ...RANDOM_FOREST_OPTIONS,
          seed: seedForUnit(unit),
        });
        evaluationModel.train(
          trainingExamples.map(example => example.features),
          trainingValues,
        );
        evaluationPredictions = predictBatchNonNegative(evaluationModel, holdoutExamples);
      }

      const actual = holdoutExamples.map(example => example.target);
      const lastWeekMetrics = calculateMetrics(
        actual,
        holdoutExamples.map(example => baselinePrediction(example, 'last-week')),
      );
      const movingAverageMetrics = calculateMetrics(
        actual,
        holdoutExamples.map(example => baselinePrediction(example, 'moving-average-4')),
      );
      const randomForestMetrics = evaluationModel
        ? calculateMetrics(actual, evaluationPredictions)
        : null;
      const bestBaselineMethod = bestBaseline({
        lastWeek: lastWeekMetrics,
        movingAverage4: movingAverageMetrics,
      });
      const bestBaselineMetrics = bestBaselineMethod === 'last-week'
        ? lastWeekMetrics
        : movingAverageMetrics;
      const selectedMethod = randomForestMetrics
        && bestBaselineMetrics
        && randomForestMetrics.mae < bestBaselineMetrics.mae
        ? 'random-forest'
        : bestBaselineMethod;

      const deploymentModel = selectedMethod === 'random-forest' && trainingExamples.length > 0
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

      for (let index = 0; index < holdoutExamples.length; index += 1) {
        const example = holdoutExamples[index];
        if (!testPredictions.has(example.key)) testPredictions.set(example.key, []);
        testPredictions.get(example.key).push({
          actual: example.target,
          randomForest: evaluationPredictions[index] ?? null,
          lastWeek: baselinePrediction(example, 'last-week'),
          movingAverage4: baselinePrediction(example, 'moving-average-4'),
        });
      }

      totalHoldoutObservations += holdoutExamples.length;
      const metrics = {
        selectedMethod,
        selected: publicMetrics(selectedMethod === 'random-forest'
          ? randomForestMetrics
          : bestBaselineMetrics),
        randomForest: publicMetrics(randomForestMetrics),
        lastWeek: publicMetrics(lastWeekMetrics),
        movingAverage4: publicMetrics(movingAverageMetrics),
      };
      unitEvaluations.push({
        unit,
        selectedMethod,
        trainingObservations: trainingExamples.length,
        holdoutObservations: holdoutExamples.length,
        metrics,
      });
      unitModels.push({
        unit,
        selectedMethod,
        randomForest: deploymentModel,
        metrics,
        trainingObservations: unitExamples.length,
        holdoutObservations: holdoutExamples.length,
      });
    }

    const perSeries = dataset.series.map(item => {
      const examples = testPredictions.get(item.key) ?? [];
      const unitModel = unitModels.find(model => model.unit === item.unit);
      if (examples.length === 0 || !unitModel) {
        seriesEvaluations.set(item.key, null);
        return {
          businessId: item.businessId,
          productId: item.productId,
          unit: item.unit,
          status: 'insufficient-data',
          historyObservations: item.history.length,
          holdoutObservations: 0,
        };
      }

      const actual = examples.map(example => example.actual);
      const randomForestMetrics = examples.some(example => example.randomForest === null)
        ? null
        : calculateMetrics(actual, examples.map(example => example.randomForest));
      const lastWeekMetrics = calculateMetrics(actual, examples.map(example => example.lastWeek));
      const movingAverageMetrics = calculateMetrics(actual, examples.map(example => example.movingAverage4));
      const selectedMetrics = unitModel.selectedMethod === 'random-forest'
        ? randomForestMetrics
        : unitModel.selectedMethod === 'moving-average-4'
          ? movingAverageMetrics
          : lastWeekMetrics;
      const result = {
        selectedMethod: unitModel.selectedMethod,
        selected: publicMetrics(selectedMetrics),
        randomForest: publicMetrics(randomForestMetrics),
        lastWeek: publicMetrics(lastWeekMetrics),
        movingAverage4: publicMetrics(movingAverageMetrics),
        historyObservations: item.history.length,
        trainingObservations: item.examples.filter(example => example.split === 'train').length,
        holdoutObservations: examples.length,
      };
      seriesEvaluations.set(item.key, result);
      return {
        businessId: item.businessId,
        productId: item.productId,
        unit: item.unit,
        status: 'evaluated',
        ...result,
      };
    });

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
          split: 'chronological-by-series',
          trainRatio: TRAIN_RATIO,
          featureWindowWeeks: LAG_WEEKS,
          target: 'units_sold',
          selectionMetric: 'MAE por unidad; Random Forest se selecciona solo si supera ambas líneas base.',
          baselines: ['last-week', 'moving-average-4'],
        },
        modelName: 'RandomForestRegression con selección por unidad',
        sourceOrigin: dataset.sourceOrigin,
        syntheticData: dataset.sourceOrigin !== 'operational',
        seriesCount: dataset.series.length,
        evaluatedSeriesCount: perSeries.filter(item => item.status === 'evaluated').length,
        holdoutObservations: totalHoldoutObservations,
        metricsByUnit: unitEvaluations,
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

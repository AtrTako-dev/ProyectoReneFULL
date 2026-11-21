const LAG_WEEKS = 4;
const WEEK_MILLISECONDS = 7 * 24 * 60 * 60 * 1000;

function seriesKey(businessId, productId) {
  return `${String(businessId)}\u001f${String(productId)}`;
}

function sortedUnique(values) {
  return [...new Set(values.map(String))].sort((left, right) => left.localeCompare(right, 'es', {
    numeric: true,
  }));
}

function weekDifference(left, right) {
  return (Date.parse(`${right}T00:00:00Z`) - Date.parse(`${left}T00:00:00Z`)) / WEEK_MILLISECONDS;
}

function makeFeatureNames(businessIds, productIds) {
  return [
    'semanas_desde_inicio',
    'demanda_semana_anterior',
    'demanda_hace_2_semanas',
    'demanda_hace_3_semanas',
    'demanda_hace_4_semanas',
    'promedio_demanda_4_semanas',
    ...businessIds.map(id => `negocio_${id}`),
    ...productIds.map(id => `producto_${id}`),
  ];
}

function makeFeatureVector({ businessId, productId, priorDemands, weeksSinceStart }, encodings) {
  if (priorDemands.length < LAG_WEEKS) return null;
  const recentDemands = priorDemands.slice(-LAG_WEEKS).reverse();
  const businessIndex = encodings.businessIds.indexOf(String(businessId));
  const productIndex = encodings.productIds.indexOf(String(productId));
  if (businessIndex < 0 || productIndex < 0) return null;

  const businessFeatures = encodings.businessIds.map((_id, index) => Number(index === businessIndex));
  const productFeatures = encodings.productIds.map((_id, index) => Number(index === productIndex));
  const averageDemand = recentDemands.reduce((sum, value) => sum + value, 0) / LAG_WEEKS;

  return [
    weeksSinceStart,
    ...recentDemands,
    averageDemand,
    ...businessFeatures,
    ...productFeatures,
  ];
}

function sourceOrigin(series) {
  const origins = new Set(series.flatMap(item => item.history.map(sale => sale.dataOrigin ?? 'synthetic')));
  if (origins.size === 0 || (origins.size === 1 && origins.has('synthetic'))) return 'synthetic';
  if (origins.size === 1 && origins.has('operational')) return 'operational';
  return 'mixed';
}

export class ForecastDatasetService {
  build(salesRepository, { trainRatio = 0.6, validationRatio = 0.2 } = {}) {
    if (!Number.isFinite(trainRatio) || trainRatio <= 0
      || !Number.isFinite(validationRatio) || validationRatio <= 0
      || trainRatio + validationRatio >= 1) {
      throw new RangeError('trainRatio y validationRatio deben ser positivos y sumar menos que uno.');
    }

    const businesses = salesRepository.getBusinesses();
    const productsByKey = new Map();
    const seriesDefinitions = [];
    for (const business of businesses) {
      for (const product of salesRepository.getProducts(business.businessId)) {
        const existingProduct = productsByKey.get(String(product.productId));
        if (existingProduct && existingProduct.unit !== product.unit) {
          throw new Error(`El producto ${product.productId} tiene unidades diferentes entre negocios.`);
        }
        productsByKey.set(String(product.productId), product);
        const history = [...salesRepository.getSeries(business.businessId, product.productId)]
          .sort((left, right) => left.startDate.localeCompare(right.startDate));
        seriesDefinitions.push({ business, product, history });
      }
    }

    const datesByUnit = new Map();
    for (const { product, history } of seriesDefinitions) {
      if (!datesByUnit.has(product.unit)) datesByUnit.set(product.unit, new Set());
      const dates = datesByUnit.get(product.unit);
      for (const sale of history) dates.add(sale.startDate);
    }
    const cutoffsByUnit = new Map([...datesByUnit].map(([unit, dates]) => {
      const orderedDates = [...dates].sort();
      return [unit, {
        training: orderedDates[Math.floor(orderedDates.length * trainRatio)],
        validation: orderedDates[Math.floor(orderedDates.length * (trainRatio + validationRatio))],
      }];
    }));

    const businessIds = sortedUnique(businesses.map(business => business.businessId));
    const productIds = sortedUnique([...productsByKey.keys()]);
    const encodings = { businessIds, productIds };
    const featureNames = makeFeatureNames(businessIds, productIds);
    const series = [];
    const examples = [];

    for (const { business, product, history } of seriesDefinitions) {
      const key = seriesKey(business.businessId, product.productId);
      const seriesEntry = {
        key,
        businessId: String(business.businessId),
        businessName: business.businessName,
        productId: String(product.productId),
        productName: product.productName,
        category: product.category,
        unit: product.unit,
        history,
        examples: [],
      };

      const cutoffs = cutoffsByUnit.get(product.unit);
      for (let targetIndex = LAG_WEEKS; targetIndex < history.length; targetIndex += 1) {
        const firstLagIndex = targetIndex - LAG_WEEKS;
        const lagWindow = history.slice(firstLagIndex, targetIndex + 1);
        const hasFourConsecutiveWeeks = lagWindow.every((sale, offset) => (
          offset === 0 || weekDifference(lagWindow[offset - 1].startDate, sale.startDate) === 1
        ));
        if (!hasFourConsecutiveWeeks) continue;

        const weeksSinceStart = Math.round(weekDifference(history[0]?.startDate, history[targetIndex].startDate)) + 1;
        const priorDemands = history.slice(firstLagIndex, targetIndex).map(sale => Number(sale.unitsSold));
        const target = Number(history[targetIndex].unitsSold);
        if (![...priorDemands, target, weeksSinceStart].every(Number.isFinite)
          || priorDemands.some(value => value < 0) || target < 0) {
          throw new Error(`La serie ${business.businessId}/${product.productId} tiene cantidades inválidas.`);
        }

        const example = {
          key,
          businessId: seriesEntry.businessId,
          productId: seriesEntry.productId,
          unit: seriesEntry.unit,
          targetIndex,
          weeksSinceStart,
          target,
          split: history[targetIndex].startDate < cutoffs.training
            ? 'train'
            : history[targetIndex].startDate < cutoffs.validation
              ? 'validation'
              : 'test',
          features: makeFeatureVector({
            businessId: seriesEntry.businessId,
            productId: seriesEntry.productId,
            priorDemands,
            weeksSinceStart,
          }, encodings),
        };
        seriesEntry.examples.push(example);
        examples.push(example);
      }
      series.push(seriesEntry);
    }

    return {
      series,
      examples,
      featureNames,
      encodings,
      sourceOrigin: sourceOrigin(series),
    };
  }

  makeFutureFeatures({ businessId, productId, history, weeksSinceStart }, encodings) {
    const priorDemands = history.slice(-LAG_WEEKS).map(sale => Number(sale.unitsSold));
    if (priorDemands.length < LAG_WEEKS || priorDemands.some(value => !Number.isFinite(value) || value < 0)) {
      return null;
    }
    return makeFeatureVector({ businessId, productId, priorDemands, weeksSinceStart }, encodings);
  }
}

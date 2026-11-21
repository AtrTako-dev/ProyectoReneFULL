export function calculateForecastMetrics(actualValues, predictedValues) {
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

export function chooseForecastMethod({
  randomForestMetrics,
  lastWeekMetrics,
  movingAverage4Metrics,
}) {
  const baselineMethod = !lastWeekMetrics || !movingAverage4Metrics
    ? 'last-week'
    : movingAverage4Metrics.mae < lastWeekMetrics.mae
      ? 'moving-average-4'
      : 'last-week';
  const bestBaselineMetrics = baselineMethod === 'last-week'
    ? lastWeekMetrics
    : movingAverage4Metrics;
  const selectedMethod = randomForestMetrics
    && bestBaselineMetrics
    && randomForestMetrics.mae < bestBaselineMetrics.mae
    ? 'random-forest'
    : baselineMethod;

  return { baselineMethod, selectedMethod };
}

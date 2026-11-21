export class LinearRegressionModel {
  constructor(xValues, yValues) {
    this.slope = null;
    this.intercept = null;
    if (xValues !== undefined || yValues !== undefined) this.fit(xValues, yValues);
  }

  fit(xValues, yValues) {
    if (!Array.isArray(xValues) || !Array.isArray(yValues) || xValues.length !== yValues.length) {
      throw new TypeError('xValues and yValues must be arrays of equal length');
    }
    if (xValues.length < 2) throw new RangeError('At least two observations are required to fit the model');
    if (![...xValues, ...yValues].every(Number.isFinite)) {
      throw new TypeError('Regression input values must be finite numbers');
    }

    const xMean = xValues.reduce((sum, value) => sum + value, 0) / xValues.length;
    const yMean = yValues.reduce((sum, value) => sum + value, 0) / yValues.length;
    let covarianceNumerator = 0;
    let varianceDenominator = 0;

    for (let index = 0; index < xValues.length; index += 1) {
      const xOffset = xValues[index] - xMean;
      covarianceNumerator += xOffset * (yValues[index] - yMean);
      varianceDenominator += xOffset * xOffset;
    }

    if (varianceDenominator === 0) throw new RangeError('At least two distinct xValues are required to fit the model');
    this.slope = covarianceNumerator / varianceDenominator;
    this.intercept = yMean - this.slope * xMean;
    return this;
  }

  predict(xValue) {
    if (!Number.isFinite(this.slope) || !Number.isFinite(this.intercept)) {
      throw new Error('Model has not been fitted');
    }
    if (!Number.isFinite(xValue)) throw new TypeError('xValue must be a finite number');
    return this.slope * xValue + this.intercept;
  }

  toJSON() {
    if (!Number.isFinite(this.slope) || !Number.isFinite(this.intercept)) {
      throw new Error('Model has not been fitted');
    }
    return { name: 'linear-regression-ols', slope: this.slope, intercept: this.intercept };
  }

  static fromJSON(serialized) {
    if (serialized?.name !== 'linear-regression-ols'
      || !Number.isFinite(serialized.slope)
      || !Number.isFinite(serialized.intercept)) {
      throw new TypeError('Serialized linear regression model is invalid');
    }
    const model = new LinearRegressionModel();
    model.slope = serialized.slope;
    model.intercept = serialized.intercept;
    return model;
  }
}

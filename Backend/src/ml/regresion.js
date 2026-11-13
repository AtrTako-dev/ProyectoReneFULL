function resolverSistemaLineal(matriz, vector) {
  const n = vector.length;
  if (n === 0) throw new Error('El sistema lineal no tiene variables.');
  const aumentada = matriz.map((fila, indice) => [...fila, vector[indice]]);

  for (let columna = 0; columna < n; columna += 1) {
    let pivote = columna;
    for (let fila = columna + 1; fila < n; fila += 1) {
      if (Math.abs(aumentada[fila][columna]) > Math.abs(aumentada[pivote][columna])) {
        pivote = fila;
      }
    }
    if (Math.abs(aumentada[pivote][columna]) < 1e-12) {
      throw new Error('El sistema lineal es singular; no se puede entrenar el modelo.');
    }
    [aumentada[columna], aumentada[pivote]] = [aumentada[pivote], aumentada[columna]];

    const divisor = aumentada[columna][columna];
    for (let c = columna; c <= n; c += 1) {
      aumentada[columna][c] /= divisor;
    }
    for (let fila = 0; fila < n; fila += 1) {
      if (fila === columna) continue;
      const factor = aumentada[fila][columna];
      if (factor === 0) continue;
      for (let c = columna; c <= n; c += 1) {
        aumentada[fila][c] -= factor * aumentada[columna][c];
      }
    }
  }

  return aumentada.map((fila) => fila[n]);
}

function entrenarRidge(filas, objetivos, { alpha = 1 } = {}) {
  if (!Array.isArray(filas) || filas.length === 0) {
    throw new Error('Se requieren muestras para entrenar el modelo.');
  }
  if (filas.length !== objetivos.length) {
    throw new Error('Las muestras y los objetivos deben tener la misma longitud.');
  }
  if (filas.some((fila) => fila.length !== filas[0].length)) {
    throw new Error('Todas las muestras deben tener el mismo número de variables.');
  }
  if (!Number.isFinite(alpha) || alpha < 0) {
    throw new Error('alpha debe ser un número no negativo.');
  }

  const variables = filas[0].length;
  const normal = Array.from({ length: variables }, () => Array(variables).fill(0));
  const independiente = Array(variables).fill(0);

  for (let muestra = 0; muestra < filas.length; muestra += 1) {
    const fila = filas[muestra];
    const objetivo = objetivos[muestra];
    for (let j = 0; j < variables; j += 1) {
      independiente[j] += fila[j] * objetivo;
      for (let k = 0; k < variables; k += 1) {
        normal[j][k] += fila[j] * fila[k];
      }
    }
  }

  // El intercepto (columna 0) no se penaliza; las demás variables sí.
  for (let j = 1; j < variables; j += 1) {
    normal[j][j] += alpha;
  }

  return resolverSistemaLineal(normal, independiente);
}

function predecirRidge(coeficientes, fila) {
  return fila.reduce((suma, valor, indice) => suma + valor * coeficientes[indice], 0);
}

function errorAbsolutoMedio(real, estimado) {
  if (real.length === 0 || real.length !== estimado.length) {
    throw new Error('Las series real y estimada deben tener la misma longitud no vacía.');
  }
  let suma = 0;
  for (let indice = 0; indice < real.length; indice += 1) {
    suma += Math.abs(real[indice] - estimado[indice]);
  }
  return suma / real.length;
}

module.exports = {
  resolverSistemaLineal,
  entrenarRidge,
  predecirRidge,
  errorAbsolutoMedio,
};

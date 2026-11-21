function normalizeName(name) {
  if (typeof name !== 'string') {
    throw new TypeError('El nombre del negocio debe ser texto.');
  }

  const normalizedName = name.trim();
  const nameLength = [...normalizedName].length;

  if (nameLength === 0 || nameLength > 150) {
    throw new RangeError('El nombre del negocio debe tener entre 1 y 150 caracteres.');
  }

  return normalizedName;
}

export class Business {
  #id;
  #name;

  constructor({ id = null, name }) {
    this.#id = id;
    this.#name = normalizeName(name);
  }

  get id() {
    return this.#id;
  }

  get name() {
    return this.#name;
  }

  rename(name) {
    this.#name = normalizeName(name);
  }
}

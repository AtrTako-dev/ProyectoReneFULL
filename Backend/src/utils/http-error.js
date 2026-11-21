export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
    this.publicMessage = message;
  }
}

export function requireValue(value, message, code = 'INVALID_INPUT') {
  if (value === undefined || value === null || value === '') {
    throw new HttpError(400, code, message);
  }
  return value;
}

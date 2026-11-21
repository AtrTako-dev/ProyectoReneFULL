export class DomainError extends Error {
  constructor(message, { status = 400, code = 'BAD_REQUEST' } = {}) {
    super(message);
    this.name = 'DomainError';
    this.status = status;
    this.code = code;
  }
}

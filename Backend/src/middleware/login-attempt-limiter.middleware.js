import { createHash } from 'node:crypto';

const RATE_LIMITED_RESPONSE = Object.freeze({
  error: {
    code: 'LOGIN_RATE_LIMITED',
    message: 'Demasiados intentos. Inténtalo más tarde.',
  },
});

function positiveInteger(value, name) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`${name} debe ser un entero positivo.`);
  }
  return value;
}

export class LoginAttemptLimiter {
  #attempts = new Map();
  #clock;
  #maxAttempts;
  #windowMs;
  #blockDurationMs;
  #cleanupIntervalMs;
  #clientIpHeader;
  #cleanupTimer;

  constructor({
    maxAttempts = 5,
    windowMs = 15 * 60 * 1000,
    blockDurationMs = 15 * 60 * 1000,
    cleanupIntervalMs = 60 * 1000,
    clientIpHeader = null,
    clock = () => Date.now(),
  } = {}) {
    this.#maxAttempts = positiveInteger(maxAttempts, 'maxAttempts');
    this.#windowMs = positiveInteger(windowMs, 'windowMs');
    this.#blockDurationMs = positiveInteger(blockDurationMs, 'blockDurationMs');
    this.#cleanupIntervalMs = positiveInteger(cleanupIntervalMs, 'cleanupIntervalMs');
    if (clientIpHeader !== null && clientIpHeader !== 'cf-connecting-ip') {
      throw new RangeError('clientIpHeader solo admite cf-connecting-ip o null.');
    }
    this.#clientIpHeader = clientIpHeader;
    if (typeof clock !== 'function') throw new TypeError('clock debe ser una función.');
    this.#clock = clock;
    this.#cleanupTimer = setInterval(() => this.#removeExpiredEntries(), this.#cleanupIntervalMs);
    this.#cleanupTimer.unref?.();
  }

  #requestKey(request) {
    const rawEmail = request.body?.email ?? request.body?.correo;
    const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
    const forwardedIp = this.#clientIpHeader
      ? request.get?.(this.#clientIpHeader) ?? request.headers?.[this.#clientIpHeader]
      : null;
    const ip = String(forwardedIp || request.ip || request.socket?.remoteAddress || 'unknown');
    return createHash('sha256').update(`${email}\u0000${ip}`).digest('hex');
  }

  #getActiveEntry(key, now) {
    const entry = this.#attempts.get(key);
    if (!entry) return null;
    const expired = entry.blockedUntil !== null
      ? entry.blockedUntil <= now
      : now - entry.windowStartedAt >= this.#windowMs;
    if (expired) {
      this.#attempts.delete(key);
      return null;
    }
    return entry;
  }

  #retryAfterSeconds(blockedUntil, now) {
    return Math.max(1, Math.ceil((blockedUntil - now) / 1000));
  }

  #respondBlocked(response, blockedUntil, now) {
    response.set('Retry-After', String(this.#retryAfterSeconds(blockedUntil, now)));
    return response.status(429).json(RATE_LIMITED_RESPONSE);
  }

  #recordFailure(key) {
    const now = this.#clock();
    let entry = this.#getActiveEntry(key, now);
    if (entry?.blockedUntil !== null && entry?.blockedUntil !== undefined) {
      return {
        blocked: true,
        retryAfterSeconds: this.#retryAfterSeconds(entry.blockedUntil, now),
      };
    }
    if (!entry) entry = { windowStartedAt: now, failures: 0, blockedUntil: null };
    entry.failures += 1;
    if (entry.failures >= this.#maxAttempts) entry.blockedUntil = now + this.#blockDurationMs;
    this.#attempts.set(key, entry);
    return {
      blocked: entry.blockedUntil !== null,
      retryAfterSeconds: entry.blockedUntil === null
        ? null
        : this.#retryAfterSeconds(entry.blockedUntil, now),
    };
  }

  #removeExpiredEntries() {
    const now = this.#clock();
    for (const [key] of this.#attempts) this.#getActiveEntry(key, now);
  }

  middleware() {
    return (request, response, next) => {
      const key = this.#requestKey(request);
      const now = this.#clock();
      const entry = this.#getActiveEntry(key, now);
      if (entry?.blockedUntil !== null && entry?.blockedUntil !== undefined) {
        return this.#respondBlocked(response, entry.blockedUntil, now);
      }

      request.loginAttemptLimiter = {
        recordFailure: () => this.#recordFailure(key),
        reset: () => this.#attempts.delete(key),
      };
      return next();
    };
  }

  close() {
    clearInterval(this.#cleanupTimer);
  }
}

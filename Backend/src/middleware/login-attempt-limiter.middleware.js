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
  #maxTrackedKeys;
  #clientIpHeader;
  #cleanupTimer;

  constructor({
    maxAttempts = 5,
    windowMs = 15 * 60 * 1000,
    blockDurationMs = 15 * 60 * 1000,
    cleanupIntervalMs = 60 * 1000,
    maxTrackedKeys = 10_000,
    clientIpHeader = null,
    clock = () => Date.now(),
  } = {}) {
    this.#maxAttempts = positiveInteger(maxAttempts, 'maxAttempts');
    this.#windowMs = positiveInteger(windowMs, 'windowMs');
    this.#blockDurationMs = positiveInteger(blockDurationMs, 'blockDurationMs');
    this.#cleanupIntervalMs = positiveInteger(cleanupIntervalMs, 'cleanupIntervalMs');
    this.#maxTrackedKeys = positiveInteger(maxTrackedKeys, 'maxTrackedKeys');
    if (clientIpHeader !== null && clientIpHeader !== 'cf-connecting-ip') {
      throw new RangeError('clientIpHeader solo admite cf-connecting-ip o null.');
    }
    if (typeof clock !== 'function') throw new TypeError('clock debe ser una función.');
    this.#clientIpHeader = clientIpHeader;
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

  #entryExpiresAt(entry) {
    return entry.blockedUntil ?? entry.windowStartedAt + this.#windowMs;
  }

  #getActiveEntry(key, now) {
    const entry = this.#attempts.get(key);
    if (!entry) return null;
    if (this.#entryExpiresAt(entry) <= now) {
      this.#attempts.delete(key);
      return null;
    }
    return entry;
  }

  #removeExpiredEntries() {
    const now = this.#clock();
    for (const [key, entry] of this.#attempts) {
      if (this.#entryExpiresAt(entry) <= now) this.#attempts.delete(key);
    }
  }

  #retryAfterUntil(expiresAt, now) {
    return Math.max(1, Math.ceil((expiresAt - now) / 1000));
  }

  #retryAfterForEarliestEntry(now) {
    const nextExpiry = Math.min(...[...this.#attempts.values()].map(entry => this.#entryExpiresAt(entry)));
    return Number.isFinite(nextExpiry) ? this.#retryAfterUntil(nextExpiry, now) : 1;
  }

  #respondBlocked(response, retryAfterSeconds) {
    response.set('Retry-After', String(retryAfterSeconds));
    return response.status(429).json(RATE_LIMITED_RESPONSE);
  }

  #reserveAttempt(key) {
    const now = this.#clock();
    let entry = this.#getActiveEntry(key, now);
    if (entry?.blockedUntil !== null && entry?.blockedUntil !== undefined) {
      return {
        allowed: false,
        retryAfterSeconds: this.#retryAfterUntil(entry.blockedUntil, now),
      };
    }

    if (!entry) {
      this.#removeExpiredEntries();
      if (this.#attempts.size >= this.#maxTrackedKeys) {
        return { allowed: false, retryAfterSeconds: this.#retryAfterForEarliestEntry(now) };
      }
      entry = {
        windowStartedAt: now,
        failures: 0,
        reservations: new Set(),
        blockedUntil: null,
        provisionalBlock: false,
      };
    }

    if (entry.failures + entry.reservations.size >= this.#maxAttempts) {
      entry.blockedUntil = now + this.#blockDurationMs;
      entry.provisionalBlock = true;
      this.#attempts.set(key, entry);
      return {
        allowed: false,
        retryAfterSeconds: this.#retryAfterUntil(entry.blockedUntil, now),
      };
    }

    const reservation = Symbol('login-attempt');
    entry.reservations.add(reservation);
    this.#attempts.set(key, entry);
    return { allowed: true, reservation };
  }

  #completeAttempt(key, reservation, outcome) {
    const entry = this.#attempts.get(key);
    if (!entry || !entry.reservations.delete(reservation)) return { blocked: false };

    if (outcome === 'success') {
      this.#attempts.delete(key);
      return { blocked: false };
    }

    if (outcome === 'failure') {
      const now = this.#clock();
      entry.failures += 1;
      if (entry.failures >= this.#maxAttempts) {
        if (entry.provisionalBlock || entry.blockedUntil === null) {
          entry.blockedUntil = now + this.#blockDurationMs;
        }
        entry.provisionalBlock = false;
      }
      this.#attempts.set(key, entry);
      return {
        blocked: entry.blockedUntil !== null,
        retryAfterSeconds: entry.blockedUntil === null
          ? null
          : this.#retryAfterUntil(entry.blockedUntil, now),
      };
    }

    if (entry.provisionalBlock && entry.failures + entry.reservations.size < this.#maxAttempts) {
      entry.blockedUntil = null;
      entry.provisionalBlock = false;
    }
    if (entry.failures === 0 && entry.reservations.size === 0 && entry.blockedUntil === null) {
      this.#attempts.delete(key);
    } else {
      this.#attempts.set(key, entry);
    }
    return { blocked: entry.blockedUntil !== null };
  }

  middleware() {
    return (request, response, next) => {
      const key = this.#requestKey(request);
      const reservation = this.#reserveAttempt(key);
      if (!reservation.allowed) return this.#respondBlocked(response, reservation.retryAfterSeconds);

      request.loginAttemptLimiter = {
        recordFailure: () => this.#completeAttempt(key, reservation.reservation, 'failure'),
        reset: () => this.#completeAttempt(key, reservation.reservation, 'success'),
        cancel: () => this.#completeAttempt(key, reservation.reservation, 'cancel'),
      };
      return next();
    };
  }

  close() {
    clearInterval(this.#cleanupTimer);
  }
}

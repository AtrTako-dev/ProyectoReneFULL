import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import test from 'node:test';
import { AuthServiceError } from '../src/services/auth.service.js';
import { createAuthRouter } from '../src/routes/auth.routes.js';
import { LoginAttemptLimiter } from '../src/middleware/login-attempt-limiter.middleware.js';

function createLoginServer({
  maxAttempts = 2,
  windowMs = 60_000,
  blockDurationMs = 5_000,
  clientIpHeader = null,
  maxTrackedKeys = 10_000,
  holdFailedLogins = false,
  holdTransientLogins = false,
} = {}) {
  let currentTime = 1_000;
  let deferredLoginCount = 0;
  const pendingFailures = [];
  const limiter = new LoginAttemptLimiter({
    maxAttempts,
    windowMs,
    blockDurationMs,
    cleanupIntervalMs: 60_000,
    maxTrackedKeys,
    clientIpHeader,
    clock: () => currentTime,
  });
  const authService = {
    async login({ email, password }) {
      if (email === 'registered@ms.test' && password === 'correct_password') {
        return {
          token: 'session-token',
          user: { id: 'user-1', email },
          negocios: [],
        };
      }
      if (holdFailedLogins || (holdTransientLogins && deferredLoginCount < 2)) {
        deferredLoginCount += 1;
        return new Promise((_resolve, reject) => {
          pendingFailures.push(error => reject(error));
        });
      }
      throw new AuthServiceError(401, 'INVALID_CREDENTIALS', 'El correo o la contraseña no son correctos.');
    },
    async logout() {},
    async authenticate() {
      throw new AuthServiceError(401, 'UNAUTHENTICATED', 'Se requiere una sesión válida.');
    },
    async getBusinessesForUser() {
      return [];
    },
  };
  const app = express();
  app.use(express.json());
  app.use('/auth', createAuthRouter(authService, { loginAttemptLimiter: limiter }));
  app.use((error, _request, response, next) => {
    if (response.headersSent) return next(error);
    response.status(error.status ?? 500).json({
      error: {
        code: error.code ?? 'INTERNAL_ERROR',
        message: error.message ?? 'Error interno del servidor.',
      },
    });
  });

  const server = app.listen(0, '127.0.0.1');
  const listening = once(server, 'listening');

  return listening.then(() => ({
    startLogin(email, password, ip = '192.0.2.10') {
      return fetch(`http://127.0.0.1:${server.address().port}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(clientIpHeader ? { [clientIpHeader]: ip } : {}),
          'X-Forwarded-For': ip,
        },
        body: JSON.stringify({ email, password }),
      });
    },
    async login(email, password, ip = '192.0.2.10') {
      const response = await this.startLogin(email, password, ip);
      return {
        status: response.status,
        retryAfter: response.headers.get('retry-after'),
        body: await response.json(),
      };
    },
    async waitForPendingFailures(count) {
      for (let attempt = 0; attempt < 100; attempt += 1) {
        if (pendingFailures.length >= count) return;
        await new Promise(resolve => setImmediate(resolve));
      }
      throw new Error(`No iniciaron ${count} autenticaciones pendientes.`);
    },
    pendingFailureCount() {
      return pendingFailures.length;
    },
    releasePendingFailures(count, error = new AuthServiceError(
      401,
      'INVALID_CREDENTIALS',
      'El correo o la contraseña no son correctos.',
    )) {
      for (const reject of pendingFailures.splice(0, count)) reject(error);
    },
    setTime(value) {
      currentTime = value;
    },
    async close() {
      limiter.close();
      server.close();
      await once(server, 'close');
    },
  }));
}

test('bloquea el intento que alcanza el límite y expira después del plazo configurado', async () => {
  const server = await createLoginServer({ maxAttempts: 2, blockDurationMs: 5_000 });
  try {
    const first = await server.login('registered@ms.test', 'wrong_password');
    const second = await server.login('registered@ms.test', 'wrong_password');
    const blocked = await server.login('registered@ms.test', 'wrong_password');

    assert.equal(first.status, 401);
    assert.equal(second.status, 429);
    assert.equal(second.body.error.code, 'LOGIN_RATE_LIMITED');
    assert.equal(second.retryAfter, '5');
    assert.equal(blocked.status, 429);
    assert.equal(blocked.retryAfter, '5');

    server.setTime(6_001);
    const afterExpiry = await server.login('registered@ms.test', 'wrong_password');
    assert.equal(afterExpiry.status, 401);
  } finally {
    await server.close();
  }
});

test('un usuario distinto conserva su propio contador y el éxito restablece el contador', async () => {
  const server = await createLoginServer({ maxAttempts: 2 });
  try {
    assert.equal((await server.login('registered@ms.test', 'wrong_password')).status, 401);
    assert.equal((await server.login('registered@ms.test', 'correct_password')).status, 200);
    assert.equal((await server.login('registered@ms.test', 'wrong_password')).status, 401);
    assert.equal((await server.login('other@ms.test', 'wrong_password')).status, 401);
    assert.equal((await server.login('registered@ms.test', 'wrong_password')).status, 429);
    assert.equal((await server.login('other@ms.test', 'wrong_password')).status, 429);
  } finally {
    await server.close();
  }
});

test('la ventana configurada reinicia los fallos anteriores al alcanzar su límite de tiempo', async () => {
  const server = await createLoginServer({ maxAttempts: 2, windowMs: 1_000 });
  try {
    assert.equal((await server.login('registered@ms.test', 'wrong_password')).status, 401);
    server.setTime(2_000);
    assert.equal((await server.login('registered@ms.test', 'wrong_password')).status, 401);
    assert.equal((await server.login('registered@ms.test', 'wrong_password')).status, 429);
  } finally {
    await server.close();
  }
});

test('reserva intentos simultáneos antes de ejecutar la autenticación y bloquea el excedente', async () => {
  const server = await createLoginServer({ maxAttempts: 2, holdFailedLogins: true });
  try {
    const first = server.startLogin('registered@ms.test', 'wrong_password');
    const second = server.startLogin('registered@ms.test', 'wrong_password');
    await server.waitForPendingFailures(2);

    const blocked = await server.login('registered@ms.test', 'wrong_password');
    assert.equal(blocked.status, 429);
    assert.equal(server.pendingFailureCount(), 2);

    server.releasePendingFailures(2);
    const concurrentResults = await Promise.all([first, second].map(async pendingResponse => {
      const response = await pendingResponse;
      return { status: response.status, body: await response.json() };
    }));
    assert.deepEqual(concurrentResults.map(result => result.status), [429, 429]);
    assert.ok(concurrentResults.every(result => result.body.error.code === 'LOGIN_RATE_LIMITED'));
  } finally {
    server.releasePendingFailures(server.pendingFailureCount());
    await server.close();
  }
});

test('errores transitorios cancelan reservas y quitan el bloqueo provisional', async () => {
  const server = await createLoginServer({ maxAttempts: 2, holdTransientLogins: true });
  try {
    const first = server.startLogin('registered@ms.test', 'wrong_password');
    const second = server.startLogin('registered@ms.test', 'wrong_password');
    await server.waitForPendingFailures(2);

    assert.equal((await server.login('registered@ms.test', 'wrong_password')).status, 429);
    server.releasePendingFailures(2, new Error('Servicio de autenticación temporalmente no disponible.'));
    const transientResults = await Promise.all([first, second].map(async pendingResponse => {
      const response = await pendingResponse;
      return response.status;
    }));
    assert.deepEqual(transientResults, [500, 500]);
    assert.equal((await server.login('registered@ms.test', 'wrong_password')).status, 401);
  } finally {
    server.releasePendingFailures(server.pendingFailureCount());
    await server.close();
  }
});

test('los errores de autenticación no revelan si el correo está registrado', async () => {
  const server = await createLoginServer();
  try {
    const registered = await server.login('registered@ms.test', 'wrong_password');
    const unknown = await server.login('unknown@ms.test', 'wrong_password');

    assert.equal(registered.status, 401);
    assert.equal(unknown.status, 401);
    assert.deepEqual(registered.body, unknown.body);
  } finally {
    await server.close();
  }
});

test('el contador separa el mismo correo cuando cambia la dirección IP', async () => {
  const server = await createLoginServer({ maxAttempts: 2, clientIpHeader: 'cf-connecting-ip' });
  try {
    assert.equal((await server.login('registered@ms.test', 'wrong_password', '192.0.2.10')).status, 401);
    assert.equal((await server.login('registered@ms.test', 'wrong_password', '192.0.2.11')).status, 401);
    assert.equal((await server.login('registered@ms.test', 'wrong_password', '192.0.2.10')).status, 429);
    assert.equal((await server.login('registered@ms.test', 'wrong_password', '192.0.2.11')).status, 429);
  } finally {
    await server.close();
  }
});

test('no confía en X-Forwarded-For cuando la aplicación no configura un proxy confiable', async () => {
  const server = await createLoginServer({ maxAttempts: 2 });
  try {
    assert.equal((await server.login('registered@ms.test', 'wrong_password', '192.0.2.10')).status, 401);
    assert.equal((await server.login('registered@ms.test', 'wrong_password', '198.51.100.25')).status, 429);
  } finally {
    await server.close();
  }
});

test('mantiene acotada la memoria y vuelve a aceptar una clave cuando expira una entrada', async () => {
  const server = await createLoginServer({ maxAttempts: 2, windowMs: 1_000, maxTrackedKeys: 1 });
  try {
    assert.equal((await server.login('first@ms.test', 'wrong_password')).status, 401);
    const full = await server.login('second@ms.test', 'wrong_password');
    assert.equal(full.status, 429);
    assert.equal(full.body.error.code, 'LOGIN_RATE_LIMITED');
    assert.equal(full.retryAfter, '1');

    server.setTime(2_001);
    assert.equal((await server.login('second@ms.test', 'wrong_password')).status, 401);
  } finally {
    await server.close();
  }
});

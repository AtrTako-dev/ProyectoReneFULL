import { fileURLToPath } from 'node:url';

try {
  process.loadEnvFile(fileURLToPath(new URL('../../.env', import.meta.url)));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const configuredPort = process.env.PORT ?? '3000';

if (!/^\d+$/.test(configuredPort) || Number(configuredPort) > 65535) {
  throw new Error('PORT debe ser un entero entre 0 y 65535.');
}

export const port = Number(configuredPort);

export const nodeEnvironment = process.env.NODE_ENV ?? 'development';
export const demoModeEnabled = process.env.DEMO_MODE === 'true';

if (demoModeEnabled && nodeEnvironment !== 'development') {
  throw new Error('DEMO_MODE solo puede habilitarse con NODE_ENV=development.');
}

export const serverHost = nodeEnvironment === 'development'
  ? '127.0.0.1'
  : (process.env.HOST || '0.0.0.0');

const configuredDatabasePort = process.env.DB_PORT ?? '3306';
if (!/^\d+$/.test(configuredDatabasePort)
  || Number(configuredDatabasePort) < 1
  || Number(configuredDatabasePort) > 65535) {
  throw new Error('DB_PORT debe ser un entero entre 1 y 65535.');
}

export const databaseConfig = Object.freeze({
  host: process.env.DB_HOST ?? '',
  port: Number(configuredDatabasePort),
  user: process.env.DB_USER ?? '',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'more_stock',
  ssl: process.env.DB_SSL === 'true',
});

export const databaseConfigured = Boolean(
  databaseConfig.host && databaseConfig.user && databaseConfig.database,
);

function positiveEnvironmentInteger(name, fallback) {
  const value = process.env[name];
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < 1) {
    throw new Error(`${name} debe ser un entero positivo.`);
  }
  return Number(value);
}

export const loginAttemptLimiterConfig = Object.freeze({
  maxAttempts: positiveEnvironmentInteger('LOGIN_RATE_LIMIT_MAX_ATTEMPTS', 5),
  windowMs: positiveEnvironmentInteger('LOGIN_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
  blockDurationMs: positiveEnvironmentInteger('LOGIN_RATE_LIMIT_BLOCK_MS', 15 * 60 * 1000),
  cleanupIntervalMs: positiveEnvironmentInteger('LOGIN_RATE_LIMIT_CLEANUP_INTERVAL_MS', 60 * 1000),
  clientIpHeader: readLoginRateLimitClientIpHeader(),
});

function readLoginRateLimitClientIpHeader() {
  const header = process.env.LOGIN_RATE_LIMIT_CLIENT_IP_HEADER?.trim().toLowerCase();
  if (!header) return null;
  if (header !== 'cf-connecting-ip') {
    throw new Error('LOGIN_RATE_LIMIT_CLIENT_IP_HEADER solo admite CF-Connecting-IP o vacío.');
  }
  return header;
}

function readDemoAccounts() {
  const source = process.env.DEMO_ACCOUNTS_JSON;
  if (!source) return [];

  let accounts;
  try {
    accounts = JSON.parse(source);
  } catch {
    throw new Error('DEMO_ACCOUNTS_JSON debe contener una lista JSON válida.');
  }
  if (!Array.isArray(accounts)) {
    throw new Error('DEMO_ACCOUNTS_JSON debe contener una lista JSON.');
  }
  return accounts;
}

export const demoAccounts = demoModeEnabled ? readDemoAccounts() : [];

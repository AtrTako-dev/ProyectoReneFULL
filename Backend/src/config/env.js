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

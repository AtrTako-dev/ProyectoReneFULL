import mysql from 'mysql2/promise';
import { databaseConfig, databaseConfigured } from './env.js';

export const mysqlPool = databaseConfigured
  ? mysql.createPool({
    host: databaseConfig.host,
    port: databaseConfig.port,
    user: databaseConfig.user,
    password: databaseConfig.password,
    database: databaseConfig.database,
    ...(databaseConfig.ssl ? { ssl: { minVersion: 'TLSv1.2' } } : {}),
    charset: 'utf8mb4',
    timezone: 'Z',
    decimalNumbers: true,
    waitForConnections: true,
    connectionLimit: 8,
    queueLimit: 0,
  })
  : null;

export function requireMysqlPool() {
  if (!mysqlPool) {
    throw new Error('Configura DB_HOST, DB_USER y DB_NAME en Backend/.env para iniciar el backend.');
  }
  return mysqlPool;
}

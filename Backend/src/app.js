import express from 'express';
import { demoServices } from './config/demo-runtime.js';
import { mysqlPool } from './config/mysql-pool.js';
import { createAuthRouter } from './routes/auth.routes.js';
import { createBusinessRouter } from './routes/business.routes.js';
import { createHealthRouter } from './routes/health.routes.js';

export function createApp({
  databasePool = mysqlPool,
  services = demoServices,
  readiness = () => 'ready',
} = {}) {
  const app = express();

  app.use(express.json({ limit: '1mb' }));
  app.get('/', (_request, response) => {
    const runtimeState = readiness();
    response.json({
      servicio: 'MoreStock API',
      estado: runtimeState === 'ready' ? 'disponible' : 'inicializando',
      api: '/api/v1',
      salud: '/api/v1/health',
    });
  });
  app.use('/api/v1', createHealthRouter(databasePool, readiness));

  app.use((_request, response, next) => {
    const runtimeState = readiness();
    if (runtimeState === 'ready') return next();

    const failed = runtimeState === 'failed';
    response.set('Retry-After', '15').status(503).json({
      error: {
        code: failed ? 'SERVICE_INITIALIZATION_FAILED' : 'SERVICE_INITIALIZING',
        message: failed
          ? 'El servidor no pudo preparar los datos de la tienda.'
          : 'El servidor está cargando el catálogo y el inventario. Inténtalo de nuevo en un momento.',
      },
    });
  });

  app.use('/api/v1/auth', createAuthRouter(services.authService));
  app.use('/api/v1/businesses', createBusinessRouter(services));

  app.use((_request, response) => {
    response.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Ruta no encontrada.' },
    });
  });

  app.use((error, _request, response, next) => {
    if (response.headersSent) return next(error);

    if (error.type === 'entity.too.large') {
      return response.status(413).json({
        error: { code: 'REQUEST_TOO_LARGE', message: 'El cuerpo de la solicitud excede el límite permitido.' },
      });
    }

    if (error.type === 'entity.parse.failed') {
      return response.status(400).json({
        error: { code: 'INVALID_JSON', message: 'El cuerpo debe contener JSON válido.' },
      });
    }

    const status = error.status;
    if (Number.isInteger(status) && ((status >= 400 && status < 500) || status === 503)) {
      if (status === 503) response.set('Retry-After', '10');
      return response.status(status).json({
        error: {
          code: error.code ?? (status === 400 ? 'BAD_REQUEST' : 'REQUEST_ERROR'),
          message: error.publicMessage ?? error.message ?? 'Solicitud inválida.',
        },
      });
    }

    return response.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor.' },
    });
  });

  return app;
}

const app = createApp();

export default app;

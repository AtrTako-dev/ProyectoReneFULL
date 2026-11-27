import { Router } from 'express';
import { createHealthController } from '../controllers/health.controller.js';

export function createHealthRouter(databasePool, readiness) {
  const healthRouter = Router();
  healthRouter.get('/health', createHealthController(databasePool, readiness));
  return healthRouter;
}

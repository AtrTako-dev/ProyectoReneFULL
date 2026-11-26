import { Router } from 'express';
import { createHealthController } from '../controllers/health.controller.js';

export function createHealthRouter(databasePool) {
  const healthRouter = Router();
  healthRouter.get('/health', createHealthController(databasePool));
  return healthRouter;
}

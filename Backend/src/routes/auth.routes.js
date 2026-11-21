import { Router } from 'express';
import { createAuthController } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/authentication.middleware.js';

export function createAuthRouter(authService) {
  const router = Router();
  const controller = createAuthController(authService);
  const authenticated = requireAuth(authService);

  router.post('/register', controller.register);
  router.post('/login', controller.login);
  router.post('/logout', authenticated, controller.logout);
  router.get('/me', authenticated, controller.me);

  return router;
}

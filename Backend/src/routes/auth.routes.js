import { Router } from 'express';
import { createAuthController } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/authentication.middleware.js';
import { LoginAttemptLimiter } from '../middleware/login-attempt-limiter.middleware.js';
import { loginAttemptLimiterConfig } from '../config/env.js';

export function createAuthRouter(authService, {
  loginAttemptLimiter = new LoginAttemptLimiter(loginAttemptLimiterConfig),
} = {}) {
  const router = Router();
  const controller = createAuthController(authService);
  const authenticated = requireAuth(authService);

  router.post('/register', controller.register);
  router.post('/login', loginAttemptLimiter.middleware(), controller.login);
  router.post('/logout', authenticated, controller.logout);
  router.get('/me', authenticated, controller.me);

  return router;
}

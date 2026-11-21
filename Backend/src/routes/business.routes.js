import { Router } from 'express';
import { createBusinessController } from '../controllers/business.controller.js';
import {
  requireAuth,
  requireBusinessAccess,
  requireBusinessRole,
} from '../middleware/authentication.middleware.js';

export function createBusinessRouter(services) {
  const router = Router();
  const controller = createBusinessController(services);
  const authenticated = requireAuth(services.authService);
  const businessAccess = requireBusinessAccess(services.authService);

  router.use(authenticated);
  router.get('/', controller.listBusinesses);
  router.post('/', controller.createBusiness);

  router.use('/:businessId', businessAccess);
  router.get('/:businessId/members', controller.listMembers);
  router.post(
    '/:businessId/members',
    requireBusinessRole('business_admin'),
    controller.addMember,
  );
  router.get('/:businessId/products', controller.listProducts);
  router.get('/:businessId/sales', controller.listSales);
  router.get('/:businessId/inventory', controller.getInventory);
  router.get('/:businessId/inventory/:productId/movements', controller.getInventoryMovements);
  router.post('/:businessId/inventory/:productId/movements', controller.recordInventoryMovement);
  router.put('/:businessId/inventory/:productId', controller.updateInventory);
  router.get('/:businessId/products/:productId/forecast', controller.getForecast);
  router.get('/:businessId/products/:productId/recommendation', controller.getRecommendation);
  router.get('/:businessId/products/:productId/explanation', controller.getExplanation);
  router.get('/:businessId/recommendations', controller.listRecommendations);
  router.get('/:businessId/calendar', controller.listCalendarEvents);
  router.get('/:businessId/model/evaluation', controller.getModelEvaluation);
  router.get('/:businessId/dashboard', controller.getDashboard);

  return router;
}

import { HttpError } from '../utils/http-error.js';

export function requireAuth(authService) {
  return async function authenticateRequest(request, _response, next) {
    try {
      const authorization = request.get('authorization') ?? '';
      const match = /^Bearer\s+(.+)$/i.exec(authorization);
      if (!match) {
        throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Inicia sesión para continuar.');
      }

      const token = match[1].trim();
      if (!token) {
        throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Inicia sesión para continuar.');
      }

      const session = await authService.authenticate(token);
      request.auth = { ...session, token };
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireBusinessAccess(authService) {
  return async function authorizeBusiness(request, _response, next) {
    try {
      const businessId = request.params.businessId;
      const userId = request.auth?.user?.id ?? request.auth?.user?.user_id;
      if (!businessId || userId === undefined) {
        throw new HttpError(403, 'BUSINESS_ACCESS_DENIED', 'No tienes acceso a este negocio.');
      }

      const membership = await authService.getMembership(userId, businessId);
      if (!membership) {
        throw new HttpError(403, 'BUSINESS_ACCESS_DENIED', 'No tienes acceso a este negocio.');
      }

      request.businessMembership = membership;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireBusinessRole(...allowedRoles) {
  return function authorizeRole(request, _response, next) {
    const role = request.businessMembership?.role;
    if (!allowedRoles.includes(role)) {
      return next(new HttpError(403, 'ROLE_REQUIRED', 'Tu rol no permite realizar esta acción.'));
    }
    next();
  };
}

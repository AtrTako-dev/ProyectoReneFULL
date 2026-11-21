import { HttpError } from '../utils/http-error.js';

function readCredentials(body = {}) {
  return {
    email: body.email ?? body.correo,
    password: body.password ?? body.contrasena,
  };
}

export function createAuthController(authService) {
  return {
    register: async (request, response) => {
      const { email, password } = readCredentials(request.body);
      const businessName = request.body?.businessName ?? request.body?.nombre_negocio;
      if (!businessName) {
        throw new HttpError(400, 'BUSINESS_NAME_REQUIRED', 'Indica el nombre de tu negocio.');
      }

      const result = await authService.register({ email, password, businessName });
      response.status(201).json({
        token: result.token,
        usuario: result.user,
        negocio: result.negocio,
      });
    },

    login: async (request, response) => {
      const result = await authService.login(readCredentials(request.body));
      response.json({
        token: result.token,
        usuario: result.user,
        negocios: result.negocios,
      });
    },

    logout: async (request, response) => {
      await authService.logout(request.auth.token);
      response.status(204).end();
    },

    me: async (request, response) => {
      const userId = request.auth.user?.id ?? request.auth.user?.user_id;
      const businesses = await authService.getBusinessesForUser(userId);
      response.json({ usuario: request.auth.user, negocios: businesses });
    },
  };
}

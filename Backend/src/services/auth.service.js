import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { BUSINESS_ROLES, BusinessMembership } from '../models/business-membership.model.js';
import { Business } from '../models/business.model.js';
import { User } from '../models/user.model.js';

const SESSION_TTL_MS = 15 * 60 * 1000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class AuthServiceError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'AuthServiceError';
    this.status = status;
    this.code = code;
  }
}

function badRequest(message) {
  return new AuthServiceError(400, 'INVALID_INPUT', message);
}

function normalizeEmail(email) {
  if (typeof email !== 'string') {
    throw badRequest('Se requiere un correo electrónico válido.');
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail.length > 254 || !EMAIL_PATTERN.test(normalizedEmail)) {
    throw badRequest('Se requiere un correo electrónico válido.');
  }
  return normalizedEmail;
}

function validatePassword(password) {
  if (typeof password !== 'string' || [...password].length < 8) {
    throw badRequest('La contraseña debe tener al menos 8 caracteres.');
  }
  return password;
}

function validId(id, label) {
  if ((typeof id !== 'string' && typeof id !== 'number') || String(id).trim() === '') {
    throw badRequest(`Se requiere un ID de ${label} válido.`);
  }
  return String(id);
}

function normalizeBusinessName(name) {
  try {
    return new Business({ name }).name;
  } catch (error) {
    if (error instanceof TypeError || error instanceof RangeError) {
      throw badRequest(error.message);
    }
    throw error;
  }
}

function tokenDigest(token) {
  return createHash('sha256').update(token).digest('hex');
}

function userFromRow(row) {
  return new User({
    id: String(row.id),
    email: row.email,
    createdAt: row.created_at,
    passwordSalt: row.password_salt,
    passwordHash: row.password_hash,
  });
}

function publicUserFromSession(row) {
  return {
    id: String(row.id),
    email: row.email,
    createdAt: row.created_at,
  };
}

function publicBusiness(row, role) {
  return { id: String(row.id), name: row.name, role };
}

function isDuplicateError(error) {
  return error?.code === 'ER_DUP_ENTRY';
}

export class AuthService {
  #repository;
  #demoAccounts;
  #businesses;
  #dummyUserPromise;
  #initialization;

  constructor({ repository, businesses = [], demoAccounts = [] } = {}) {
    if (!repository) throw new TypeError('AuthService requiere un repositorio MySQL.');
    this.#repository = repository;
    this.#businesses = businesses;
    this.#demoAccounts = demoAccounts;
    this.#dummyUserPromise = User.create({
      email: '',
      password: randomBytes(32).toString('base64url'),
    });
  }

  initialize() {
    if (!this.#initialization) this.#initialization = this.#initialize();
    return this.#initialization;
  }

  async #initialize() {
    if (!Array.isArray(this.#businesses) || !Array.isArray(this.#demoAccounts)) {
      throw badRequest('Los negocios y las cuentas demo deben proporcionarse como listas.');
    }

    await this.#repository.upsertBusinesses(this.#businesses);
    await this.#repository.deleteExpiredSessions();

    for (const account of this.#demoAccounts) {
      if (!account || typeof account !== 'object' || Array.isArray(account)) {
        throw badRequest('Cada cuenta demo debe contener datos válidos.');
      }

      const email = normalizeEmail(account.email);
      const password = validatePassword(account.password);
      const role = account.role ?? 'business_admin';
      if (!BUSINESS_ROLES.includes(role)) {
        throw badRequest('La cuenta demo debe usar un rol de negocio válido.');
      }

      const businessId = validId(account.businessId, 'negocio');
      let business = await this.#repository.findBusiness(businessId);
      if (!business && account.businessName) {
        const model = new Business({ id: businessId, name: normalizeBusinessName(account.businessName) });
        await this.#repository.transaction(repository => repository.createBusiness(model));
        business = { id: model.id, name: model.name };
      }
      if (!business) {
        throw badRequest('Cada cuenta demo debe pertenecer a un negocio disponible.');
      }
      if (account.businessName && business.name !== normalizeBusinessName(account.businessName)) {
        throw badRequest('El nombre de la cuenta demo no coincide con el negocio existente.');
      }

      const existingUser = await this.#repository.findUserByEmail(email);
      const user = await User.create({ id: existingUser?.id, email, password });
      try {
        await this.#repository.transaction(async repository => {
          if (existingUser) {
            await repository.updateUserPassword(user.toStorageObject());
          } else {
            await repository.createUser(user.toStorageObject());
          }
          await repository.upsertMembership({ userId: user.id, businessId, role });
        });
      } catch (error) {
        if (!isDuplicateError(error)) throw error;
      }
    }
  }

  async #requireInitialized() {
    if (!this.#initialization) {
      throw new Error('AuthService no se inicializó; inicia el servidor antes de usar la API.');
    }
    await this.#initialization;
  }

  async #storeSession(userId) {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = Date.now() + SESSION_TTL_MS;
    await this.#repository.createSession({
      tokenHash: tokenDigest(token),
      userId,
      expiresAt,
    });
    return { token, expiresAt: new Date(expiresAt).toISOString() };
  }

  async register({ email: rawEmail, password: rawPassword, businessName } = {}) {
    await this.#requireInitialized();
    const email = normalizeEmail(rawEmail);
    const password = validatePassword(rawPassword);
    const normalizedBusinessName = normalizeBusinessName(businessName);
    const business = new Business({ id: randomUUID(), name: normalizedBusinessName });
    const user = await User.create({ email, password });
    const membership = new BusinessMembership({
      businessId: business.id,
      userId: user.id,
      role: 'business_admin',
    });
    const token = randomBytes(32).toString('base64url');
    const expiresAt = Date.now() + SESSION_TTL_MS;

    try {
      await this.#repository.transaction(async repository => {
        await repository.createUser(user.toStorageObject());
        await repository.createBusiness(business);
        await repository.createMembership(membership.toPublicObject());
        await repository.createSession({
          tokenHash: tokenDigest(token),
          userId: user.id,
          expiresAt,
        });
      });
    } catch (error) {
      if (isDuplicateError(error)) {
        throw new AuthServiceError(409, 'EMAIL_ALREADY_REGISTERED', 'Ya existe una cuenta con este correo.');
      }
      throw error;
    }

    return {
      token,
      user: user.toPublicObject(),
      negocio: publicBusiness(business, membership.role),
    };
  }

  async login({ email: rawEmail, password: rawPassword } = {}) {
    await this.#requireInitialized();
    const email = normalizeEmail(rawEmail);
    const password = validatePassword(rawPassword);
    const row = await this.#repository.findUserByEmail(email);
    const user = row ? userFromRow(row) : await this.#dummyUserPromise;
    const validPassword = await user.verifyPassword(password);
    if (!row || !validPassword) {
      throw new AuthServiceError(401, 'INVALID_CREDENTIALS', 'El correo o la contraseña no son correctos.');
    }

    const session = await this.#storeSession(row.id);
    return {
      token: session.token,
      user: user.toPublicObject(),
      negocios: await this.getBusinessesForUser(row.id),
    };
  }

  async logout(token) {
    await this.#requireInitialized();
    if (typeof token !== 'string' || token.length === 0) {
      throw badRequest('Se requiere un token de sesión.');
    }
    await this.#repository.deleteSession(tokenDigest(token));
    return { loggedOut: true };
  }

  async authenticate(token) {
    await this.#requireInitialized();
    if (typeof token !== 'string' || token.length === 0) {
      throw new AuthServiceError(401, 'UNAUTHENTICATED', 'Se requiere una sesión válida.');
    }

    const row = await this.#repository.findSession(tokenDigest(token));
    if (!row) {
      throw new AuthServiceError(401, 'UNAUTHENTICATED', 'Se requiere una sesión válida.');
    }

    const expiresAt = new Date(row.expires_at).getTime();
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      await this.#repository.deleteSession(tokenDigest(token));
      throw new AuthServiceError(401, 'SESSION_EXPIRED', 'La sesión venció.');
    }

    return {
      user: publicUserFromSession(row),
      expiresAt: new Date(expiresAt).toISOString(),
    };
  }

  async getBusinessesForUser(userId) {
    await this.#requireInitialized();
    return this.#repository.listBusinessesForUser(validId(userId, 'usuario'));
  }

  async getMembership(userId, businessId) {
    await this.#requireInitialized();
    const membership = await this.#repository.findMembership(
      validId(userId, 'usuario'),
      validId(businessId, 'negocio'),
    );
    return membership
      ? { userId: String(membership.user_id), businessId: String(membership.business_id), role: membership.role }
      : null;
  }

  async listMembers(requesterId, businessId) {
    await this.#requireInitialized();
    const normalizedBusinessId = validId(businessId, 'negocio');
    const requesterMembership = await this.#repository.findMembership(
      validId(requesterId, 'usuario'),
      normalizedBusinessId,
    );
    if (!requesterMembership) {
      throw new AuthServiceError(403, 'FORBIDDEN', 'El usuario no pertenece a este negocio.');
    }
    return this.#repository.listMembers(normalizedBusinessId);
  }

  async addMember(requesterId, businessId, { email: rawEmail, role = 'employee' } = {}) {
    await this.#requireInitialized();
    const normalizedRequesterId = validId(requesterId, 'usuario');
    const normalizedBusinessId = validId(businessId, 'negocio');
    const requesterMembership = await this.#repository.findMembership(
      normalizedRequesterId,
      normalizedBusinessId,
    );
    if (!requesterMembership || requesterMembership.role !== 'business_admin') {
      throw new AuthServiceError(403, 'FORBIDDEN', 'Solo un administrador del negocio puede agregar miembros.');
    }
    if (!BUSINESS_ROLES.includes(role)) throw badRequest('El rol de membresía no es válido.');

    const email = normalizeEmail(rawEmail);
    const user = await this.#repository.findUserByEmail(email);
    if (!user) throw new AuthServiceError(404, 'USER_NOT_FOUND', 'No se encontró una cuenta con este correo.');
    if (await this.#repository.findMembership(user.id, normalizedBusinessId)) {
      throw new AuthServiceError(409, 'MEMBERSHIP_ALREADY_EXISTS', 'El usuario ya pertenece a este negocio.');
    }

    const business = await this.#repository.findBusiness(normalizedBusinessId);
    if (!business) throw new AuthServiceError(404, 'BUSINESS_NOT_FOUND', 'No se encontró el negocio.');

    try {
      await this.#repository.createMembership({ userId: user.id, businessId: normalizedBusinessId, role });
    } catch (error) {
      if (isDuplicateError(error)) {
        throw new AuthServiceError(409, 'MEMBERSHIP_ALREADY_EXISTS', 'El usuario ya pertenece a este negocio.');
      }
      throw error;
    }
    return {
      id: String(user.id),
      email: user.email,
      businessId: String(business.id),
      businessName: business.name,
      role,
    };
  }

  async createBusiness(userId, { name } = {}) {
    await this.#requireInitialized();
    const normalizedUserId = validId(userId, 'usuario');
    const row = await this.#repository.findUserById(normalizedUserId);
    if (!row) throw new AuthServiceError(401, 'UNAUTHENTICATED', 'Se requiere una cuenta válida.');

    const business = new Business({ id: randomUUID(), name: normalizeBusinessName(name) });
    const membership = new BusinessMembership({
      businessId: business.id,
      userId: normalizedUserId,
      role: 'business_admin',
    });
    await this.#repository.transaction(async repository => {
      await repository.createBusiness(business);
      await repository.createMembership(membership.toPublicObject());
    });
    return publicBusiness(business, membership.role);
  }
}

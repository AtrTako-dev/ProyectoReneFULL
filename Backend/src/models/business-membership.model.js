export const BUSINESS_ROLES = Object.freeze(['business_admin', 'employee']);

export class BusinessMembership {
  #businessId;
  #userId;
  #role;

  constructor({ businessId, userId, role }) {
    if (!BUSINESS_ROLES.includes(role)) {
      throw new RangeError('El rol de membresía no es válido.');
    }

    this.#businessId = businessId;
    this.#userId = userId;
    this.#role = role;
  }

  get businessId() {
    return this.#businessId;
  }

  get userId() {
    return this.#userId;
  }

  get role() {
    return this.#role;
  }

  toPublicObject() {
    return {
      userId: this.#userId,
      businessId: this.#businessId,
      role: this.#role,
    };
  }
}

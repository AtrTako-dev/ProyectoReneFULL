import { randomUUID } from 'node:crypto';
import { hashPassword, verifyPassword } from '../services/password.service.js';

export class User {
  #id;
  #email;
  #createdAt;
  #passwordSalt;
  #passwordHash;

  constructor({ id = randomUUID(), email, createdAt = new Date(), passwordSalt, passwordHash }) {
    this.#id = id;
    this.#email = email;
    this.#createdAt = new Date(createdAt).toISOString();
    this.#passwordSalt = Buffer.from(passwordSalt);
    this.#passwordHash = Buffer.from(passwordHash);
  }

  static async create({ id, email, password, createdAt }) {
    const credentials = await hashPassword(password);
    return new User({
      id,
      email,
      createdAt,
      passwordSalt: credentials.salt,
      passwordHash: credentials.hash,
    });
  }

  get id() {
    return this.#id;
  }

  get email() {
    return this.#email;
  }

  get createdAt() {
    return this.#createdAt;
  }

  async verifyPassword(password) {
    return verifyPassword(password, {
      salt: this.#passwordSalt,
      hash: this.#passwordHash,
    });
  }

  toPublicObject() {
    return {
      id: this.#id,
      email: this.#email,
      createdAt: this.#createdAt,
    };
  }

  toStorageObject() {
    return {
      id: this.#id,
      email: this.#email,
      createdAt: this.#createdAt,
      passwordSalt: Buffer.from(this.#passwordSalt),
      passwordHash: Buffer.from(this.#passwordHash),
    };
  }
}

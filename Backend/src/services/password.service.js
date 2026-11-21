import { promisify } from 'node:util';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = Object.freeze({
  N: 16_384,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
});

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, KEY_LENGTH, SCRYPT_OPTIONS);
  return { salt, hash };
}

export async function verifyPassword(password, credentials) {
  const candidateHash = await scrypt(password, credentials.salt, KEY_LENGTH, SCRYPT_OPTIONS);
  return timingSafeEqual(candidateHash, credentials.hash);
}

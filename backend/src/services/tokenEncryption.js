import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits recommended for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * Derive a 32-byte (256-bit) key from the given secret string.
 */
function deriveKey(secretKey) {
  if (!secretKey) {
    throw new Error('Encryption key must not be empty.');
  }
  return crypto.createHash('sha256').update(String(secretKey)).digest();
}

/**
 * Encrypt a token object or string using AES-256-GCM.
 * @param {object|string} data - Token payload to encrypt
 * @param {string} secretKey - Secret key for encryption
 * @returns {{ encryptedData: string, iv: string, authTag: string }}
 */
export function encryptTokens(data, secretKey) {
  if (!data) {
    return { encryptedData: '', iv: '', authTag: '' };
  }

  const key = deriveKey(secretKey);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const plaintext = typeof data === 'string' ? data : JSON.stringify(data);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return {
    encryptedData: encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
  };
}

/**
 * Decrypt AES-256-GCM ciphertext back to the original object or string.
 * @param {{ encryptedData: string, iv: string, authTag: string }} record
 * @param {string} secretKey - Secret key for decryption
 * @returns {object|string} Decrypted object or raw string
 */
export function decryptTokens(record, secretKey) {
  if (!record || !record.encryptedData || !record.iv || !record.authTag) {
    return null;
  }

  const key = deriveKey(secretKey);
  const iv = Buffer.from(record.iv, 'hex');
  const authTag = Buffer.from(record.authTag, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(record.encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  try {
    return JSON.parse(decrypted);
  } catch {
    return decrypted;
  }
}

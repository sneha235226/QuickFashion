const crypto = require('crypto');
const env    = require('../config/env');

const ALGORITHM = 'aes-256-gcm';
const KEY       = Buffer.from(env.ENCRYPTION_KEY, 'hex'); // must be 32 bytes

/**
 * Encrypt plaintext using AES-256-GCM.
 * Returns a colon-delimited string: iv:authTag:ciphertext  (all hex)
 */
const encrypt = (plaintext) => {
  const iv         = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher     = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const encrypted  = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag    = cipher.getAuthTag();

  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':');
};

/**
 * Decrypt a value produced by encrypt().
 */
const decrypt = (encryptedString) => {
  const [ivHex, authTagHex, ciphertextHex] = encryptedString.split(':');
  const iv         = Buffer.from(ivHex, 'hex');
  const authTag    = Buffer.from(authTagHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
};

/**
 * HMAC-SHA256 of plaintext — deterministic, used for duplicate detection
 * without storing the plaintext.
 */
const hmac = (plaintext) =>
  crypto.createHmac('sha256', env.HMAC_SECRET).update(plaintext).digest('hex');

module.exports = { encrypt, decrypt, hmac };

const crypto = require('crypto');
const env = require('../config/env');

/**
 * Decrypts sensitive data like account numbers for admin view.
 */
const decrypt = (text) => {
  if (!text) return null;
  try {
    const key = Buffer.from(env.JWT_ACCESS_SECRET.padEnd(32, '0').slice(0, 32));
    const iv = Buffer.alloc(16, 0);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(text, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Decryption failed:', err);
    return null;
  }
};

module.exports = { decrypt };

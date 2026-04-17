const crypto = require('crypto');

/** Generate a cryptographically random 6-digit OTP string. */
const generate = () => {
  // Random number 100000–999999
  const bytes = crypto.randomBytes(3);            // 3 bytes = 0–16777215
  const num   = (bytes.readUIntBE(0, 3) % 900000) + 100000;
  return String(num);
};

/** SHA-256 hash of the OTP. Stored in DB so plaintext is never persisted. */
const hash = (otp) =>
  crypto.createHash('sha256').update(otp).digest('hex');

/** Constant-time comparison of two hashes. */
const compare = (otp, storedHash) =>
  crypto.timingSafeEqual(
    Buffer.from(hash(otp), 'hex'),
    Buffer.from(storedHash, 'hex')
  );

module.exports = { generate, hash, compare };

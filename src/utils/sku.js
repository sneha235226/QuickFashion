const crypto = require('crypto');

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/**
 * Generate a random SKU string: PRD-XXXXXXXX (8 alphanumeric chars, uppercase).
 * Uses crypto.randomBytes — cryptographically random, no external dependency.
 */
const generateSku = () => {
  const bytes = crypto.randomBytes(8);
  const suffix = Array.from(bytes).map((b) => CHARS[b % CHARS.length]).join('');
  return `PRD-${suffix}`;
};

/**
 * Generate a unique SKU, retrying up to `maxRetries` times on collision.
 * `isUnique` — async function that receives a candidate SKU and returns true if it is available.
 *
 * Usage:
 *   const sku = await generateUniqueSku((candidate) => !skuExistsForSeller(candidate, sellerId));
 */
const generateUniqueSku = async (isUnique, maxRetries = 5) => {
  for (let i = 0; i < maxRetries; i++) {
    const candidate = generateSku();
    if (await isUnique(candidate)) return candidate;
  }
  throw new Error('Could not generate a unique SKU after several attempts. Please try again.');
};

module.exports = { generateSku, generateUniqueSku };

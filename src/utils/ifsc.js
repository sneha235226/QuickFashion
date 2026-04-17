/**
 * IFSC Validation & Mock Bank Lookup
 *
 * Real implementation would call https://ifsc.razorpay.com/:ifsc
 * For now, we validate format and return mock branch data.
 *
 * IFSC format: 4 alpha + 0 + 6 alphanumeric  (e.g. SBIN0001234)
 */

const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;

// Small mock registry — extend as needed
const BANK_REGISTRY = {
  SBIN: { bankName: 'State Bank of India',   branch: 'Main Branch' },
  HDFC: { bankName: 'HDFC Bank',             branch: 'Main Branch' },
  ICIC: { bankName: 'ICICI Bank',            branch: 'Main Branch' },
  UTIB: { bankName: 'Axis Bank',             branch: 'Main Branch' },
  KKBK: { bankName: 'Kotak Mahindra Bank',   branch: 'Main Branch' },
  PUNB: { bankName: 'Punjab National Bank',  branch: 'Main Branch' },
  BARB: { bankName: 'Bank of Baroda',        branch: 'Main Branch' },
};

/**
 * Validate IFSC format and return { bankName, branch }.
 * @returns {{ valid: boolean, bankName?: string, branch?: string, error?: string }}
 */
const validateAndLookup = (ifsc) => {
  const upper = ifsc.toUpperCase();

  if (!IFSC_REGEX.test(upper)) {
    return { valid: false, error: 'Invalid IFSC format. Expected pattern: XXXX0XXXXXX' };
  }

  const prefix = upper.slice(0, 4);
  const bank   = BANK_REGISTRY[prefix] ?? { bankName: 'Unknown Bank', branch: 'Unknown Branch' };

  return { valid: true, bankName: bank.bankName, branch: bank.branch };
};

module.exports = { validateAndLookup };

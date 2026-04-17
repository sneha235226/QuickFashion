/**
 * Maps a seller's current onboarding status to the next step label
 * returned in API responses so the client knows where to redirect.
 */

const NEXT_STEP_MAP = {
  MOBILE_VERIFICATION: 'MOBILE_VERIFICATION',
  GST_VERIFICATION:    'GST_VERIFICATION',
  ADDRESS_SETUP:       'ADDRESS_SETUP',
  BANK_SETUP:          'BANK_SETUP',
  PROFILE_SETUP:       'PROFILE_SETUP',
  COMPLETED:           null,
};

/**
 * Returns the nextStep string for a given OnboardingStatus enum value.
 * @param {string} status
 * @returns {string|null}
 */
const getNextStep = (status) => NEXT_STEP_MAP[status] ?? null;

module.exports = { getNextStep };

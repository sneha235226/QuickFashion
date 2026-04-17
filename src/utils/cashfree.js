const axios = require('axios');
const AppError = require('./AppError');

const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID;
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Auto-detect sandbox environment based on the secret key prefix
const IS_SANDBOX = CASHFREE_SECRET_KEY && CASHFREE_SECRET_KEY.startsWith('cfsk_ma_test_');
const IS_MOCK = process.env.CASHFREE_MOCK === 'true' || !CASHFREE_APP_ID || !CASHFREE_SECRET_KEY;

const BASE_URL = IS_SANDBOX
    ? 'https://sandbox.cashfree.com/verification/mobile360'
    : 'https://api.cashfree.com/verification/mobile360';

/**
 * Cashfree OTP API Wrapper (Mobile 360 V2)
 * Documentation: https://docs.cashfree.com/docs/verification-suite
 */
const sendOtp = async (mobileNumber) => {
    try {
        const verificationId = `qf_v_${Date.now()}`;

        // Handle mock mode
        if (IS_MOCK) {
            console.log(`[CASHFREE] MOCK MODE: Sending OTP to ${mobileNumber}`);
            return { success: true, requestId: verificationId };
        }

        if (IS_SANDBOX) console.log(`[CASHFREE] Using Sandbox Environment for ${mobileNumber}`);

        const response = await axios.post(
            `${BASE_URL}/otp/send`,
            {
                mobile_number: mobileNumber,
                verification_id: verificationId,
                notification_modes: ['SMS'],
                user_consent: {
                    timestamp: new Date().toISOString(),
                    purpose: 'Verification for QuickFashion Account',
                    obtained: true,
                    type: 'EXPLICIT',
                },
            },
            {
                headers: {
                    'x-client-id': CASHFREE_APP_ID,
                    'x-client-secret': CASHFREE_SECRET_KEY,
                    'x-api-version': '2022-10-26',
                    'Content-Type': 'application/json',
                },
            }
        );

        return {
            success: true,
            requestId: verificationId,
        };
    } catch (err) {
        const errorData = err.response?.data || err.message;
        console.error('Cashfree Send OTP Error:', JSON.stringify(errorData, null, 2));
        throw new AppError('Failed to send OTP. Please try again later.', 500, 'OTP_SEND_FAILED');
    }
};

const verifyOtp = async (requestId, otp) => {
    try {
        if (IS_MOCK) {
            console.log(`[CASHFREE] MOCK MODE: Verifying OTP ${otp} for request ${requestId}`);
            if (otp === '123456') return { success: true };
            throw new AppError('Invalid OTP.', 400, 'INVALID_OTP');
        }

        const response = await axios.post(
            `${BASE_URL}/otp/verify`,
            {
                verification_id: requestId,
                otp: otp,
            },
            {
                headers: {
                    'x-client-id': CASHFREE_APP_ID,
                    'x-client-secret': CASHFREE_SECRET_KEY,
                    'x-api-version': '2022-10-26',
                    'Content-Type': 'application/json',
                },
            }
        );

        return {
            success: response.data.status === 'SUCCESS' || response.data.valid === true,
        };
    } catch (err) {
        const data = err.response?.data || {};
        console.error('Cashfree Verify OTP Error:', JSON.stringify(data, null, 2));
        if (data.message === 'OTP mismatch' || data.code === 'otp_mismatch' || data.error_msg === 'OTP mismatch') {
            throw new AppError('Invalid OTP.', 400, 'INVALID_OTP');
        }
        throw new AppError('Failed to verify OTP.', 500, 'OTP_VERIFY_FAILED');
    }
};

module.exports = { sendOtp, verifyOtp };

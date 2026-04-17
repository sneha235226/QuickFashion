const axios = require('axios');
const AppError = require('./AppError');

const MSG91_AUTH_KEY = process.env.MSG91_AUTH_KEY || process.env.SMS_API_KEY;
const MSG91_TEMPLATE_ID = process.env.MSG91_TEMPLATE_ID;
const MSG91_MOCK = process.env.MSG91_MOCK === 'true' || !MSG91_AUTH_KEY;

/**
 * MSG91 OTP API Wrapper (V5)
 * Documentation: https://docs.msg91.com/p/tf9bu3be9/v/f59bu3be9/otp-api-v5
 */
const sendOtp = async (mobileNumber) => {
    try {
        if (MSG91_MOCK) {
            console.log(`[MSG91] MOCK MODE: Sending OTP to ${mobileNumber}`);
            return { requestId: `msg91_mock_${Date.now()}` };
        }

        if (!MSG91_TEMPLATE_ID) {
            throw new AppError('MSG91_TEMPLATE_ID is missing in .env', 500);
        }

        // MSG91 expects mobile with country code, e.g., 919999999999
        // We assume 10-digit mobile and prefix 91 if not present
        const formattedMobile = mobileNumber.length === 10 ? `91${mobileNumber}` : mobileNumber;

        const response = await axios.post(
            `https://control.msg91.com/api/v5/otp?template_id=${MSG91_TEMPLATE_ID}&mobile=${formattedMobile}`,
            {},
            {
                headers: {
                    authkey: MSG91_AUTH_KEY,
                    'Content-Type': 'application/json',
                },
            }
        );

        if (response.data.type === 'error') {
            throw new Error(response.data.message);
        }

        return {
            requestId: response.data.request_id || formattedMobile, // MSG91 sometimes returns request_id or uses mobile
        };
    } catch (err) {
        console.error('MSG91 Send OTP Error:', err.response?.data || err.message);
        throw new AppError('Failed to send OTP via MSG91.', 500, 'OTP_SEND_FAILED');
    }
};

const verifyOtp = async (mobileNumber, otp, requestId = null) => {
    try {
        if (MSG91_MOCK || (requestId && requestId.startsWith('msg91_mock_'))) {
            console.log(`[MSG91] MOCK MODE: Verifying OTP ${otp} for ${mobileNumber}`);
            if (otp === '123456') return { success: true };
            throw new AppError('Invalid OTP.', 400, 'INVALID_OTP');
        }

        const formattedMobile = mobileNumber.length === 10 ? `91${mobileNumber}` : mobileNumber;

        const response = await axios.get(
            `https://control.msg91.com/api/v5/otp/verify?otp=${otp}&mobile=${formattedMobile}`,
            {
                headers: {
                    authkey: MSG91_AUTH_KEY,
                },
            }
        );

        if (response.data.type === 'error') {
            if (response.data.message === 'OTP not match' || response.data.message === 'already_verified') {
                // If already verified, we might consider it a success or a specific error
                // For login flow, already_verified might mean the user is re-submitting.
                if (response.data.message === 'already_verified') return { success: true };
                throw new AppError('Invalid OTP.', 400, 'INVALID_OTP');
            }
        }

        return {
            success: response.data.type === 'success',
        };
    } catch (err) {
        const data = err.response?.data || {};
        console.error('MSG91 Verify OTP Error:', JSON.stringify(data, null, 2));
        if (data.message === 'OTP not match') {
            throw new AppError('Invalid OTP.', 400, 'INVALID_OTP');
        }
        throw new AppError('Failed to verify OTP via MSG91.', 500, 'OTP_VERIFY_FAILED');
    }
};

module.exports = { sendOtp, verifyOtp };

const OTPModel = require('../models/otp');
const UserModel = require('../models/user');
const SellerModel = require('../models/seller');
const SellerOnboardingModel = require('../models/seller_onboarding');
const msg91 = require('../utils/msg91');
const jwt = require('../utils/jwt');
const AppError = require('../utils/AppError');

const OTP_EXPIRY_MINS = 5;

/**
 * sendOtp — Calls MSG91 and stores requestId in DB.
 */
const sendOtp = async (mobileNumber, role) => {
    console.log(`[AUTH_SERVICE] sendOtp called: mobile=${mobileNumber}, role=${role}`);
    // 1. Call MSG91
    const { requestId } = await msg91.sendOtp(mobileNumber);
    console.log(`[AUTH_SERVICE] msg91.sendOtp returned requestId=${requestId}`);

    // 2. Store in DB
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINS * 60 * 1000);
    await OTPModel.create(mobileNumber, role, requestId, expiresAt);
    console.log(`[AUTH_SERVICE] OTP record created in DB.`);

    return { requestId };
};

/**
 * verifyOtp — Verifies via MSG91, then handles login/signup logic.
 */
const verifyOtp = async (mobileNumber, otp, role, requestId = null) => {
    console.log(`[AUTH_SERVICE] verifyOtp called: mobile=${mobileNumber}, otp=${otp}, role=${role}, requestId=${requestId}`);
    let otpRecord;

    if (requestId) {
        otpRecord = await OTPModel.findByRequestId(requestId);
    } else {
        // Legacy support (mostly for SELLER flow if they still use old endpoints)
        otpRecord = await OTPModel.findActiveByMobile(mobileNumber, role);
    }

    console.log(`[AUTH_SERVICE] otpRecord found:`, JSON.stringify(otpRecord, null, 2));

    if (!otpRecord) {
        console.error(`[AUTH_SERVICE] No active OTP record found for ${mobileNumber}`);
        throw new AppError('Invalid or expired OTP request.', 400, 'INVALID_REQUEST');
    }

    if (otpRecord.mobileNumber !== mobileNumber || otpRecord.role !== role) {
        throw new AppError('Request details mismatch.', 400, 'BAD_REQUEST');
    }

    if (otpRecord.used || otpRecord.expiresAt < new Date()) {
        throw new AppError('OTP expired or already used.', 400, 'OTP_EXPIRED');
    }

    // 2. Verify with MSG91
    await msg91.verifyOtp(mobileNumber, otp, otpRecord.requestId);

    // 3. Mark OTP as used
    await OTPModel.markVerified(otpRecord.id);

    let tokens;

    // 4. Role-specific logic
    if (role === 'USER') {
        let user = await UserModel.findByMobile(mobileNumber);
        if (!user) {
            user = await UserModel.create(mobileNumber);
        }
        tokens = jwt.generateUserTokens({ userId: user.id, mobile: user.mobileNumber });
        await UserModel.updateRefreshToken(user.id, tokens.refreshToken);
    } else if (role === 'SELLER') {
        const seller = await SellerModel.findByMobile(mobileNumber);
        if (seller && seller.sellerStatus === 'APPROVED') {
            tokens = jwt.generateSellerTokens({ sellerId: seller.id, mobile: seller.mobile });
            await SellerModel.updateRefreshToken(seller.id, tokens.refreshToken);
        } else {
            // Seller doesn't exist or is not approved, trigger onboarding flow
            let onboarding = await SellerOnboardingModel.findByPhone(mobileNumber);
            if (!onboarding) {
                onboarding = await SellerOnboardingModel.create({
                    phone: mobileNumber,
                });
            }
            tokens = { onboardingToken: jwt.generateOnboardingToken({ phone: mobileNumber }) };
        }
    } else {
        throw new AppError('Invalid role.', 400, 'INVALID_ROLE');
    }

    console.log(`[AUTH_SERVICE] Verified OTP for ${mobileNumber}. Tokens generated.`);
    return tokens;
};

/**
 * refreshTokens — Rotates tokens for User or Seller.
 */
const refreshTokens = async (token) => {
    let decoded;
    try {
        decoded = jwt.verifyRefreshToken(token);
    } catch (err) {
        throw new AppError('Invalid or expired refresh token.', 401, 'REFRESH_TOKEN_INVALID');
    }

    if (decoded.sellerId) {
        const seller = await SellerModel.findById(decoded.sellerId);
        if (!seller || seller.refreshToken !== token) {
            if (seller) await SellerModel.updateSeller(seller.id, { refreshToken: null });
            throw new AppError('Token invalid or reuse detected.', 401, 'TOKEN_REUSE');
        }
        const tokens = jwt.generateSellerTokens({ sellerId: seller.id, mobile: seller.mobile });
        await SellerModel.updateRefreshToken(seller.id, tokens.refreshToken);
        return { ...tokens };
    } else if (decoded.userId) {
        const user = await UserModel.findById(decoded.userId);
        if (!user || user.refreshToken !== token) {
            if (user) await UserModel.updateRefreshToken(user.id, null);
            throw new AppError('Token invalid or reuse detected.', 401, 'TOKEN_REUSE');
        }
        const tokens = jwt.generateUserTokens({ userId: user.id, mobile: user.mobileNumber });
        await UserModel.updateRefreshToken(user.id, tokens.refreshToken);
        return tokens;
    }

    throw new AppError('Invalid token payload.', 401, 'INVALID_TOKEN');
};

/**
 * logout — Clears refresh token in DB.
 */
const logout = async (id, role = 'SELLER') => {
    if (role === 'SELLER') {
        await SellerModel.updateSeller(id, { refreshToken: null });
    } else {
        await UserModel.updateRefreshToken(id, null);
    }
};

module.exports = { sendOtp, verifyOtp, refreshTokens, logout };

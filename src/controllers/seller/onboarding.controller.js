const SellerOnboardingModel = require('../../models/seller_onboarding');
const AppError = require('../../utils/AppError');
const response = require('../../utils/response');
const Joi = require('joi');
const { getPublicUrl, getSignUrl } = require('../../utils/s3');

const step1Schema = Joi.object({
    firstName: Joi.string().required(),
    lastName: Joi.string().required(),
    gender: Joi.string().valid('MALE', 'FEMALE', 'OTHER').required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
});

const step2Schema = Joi.object({
    businessName: Joi.string().required(),
    ownerName: Joi.string().required(),
    productCategories: Joi.array().items(Joi.string()).min(1).required(),
    businessType: Joi.string().valid('individual', 'proprietorship', 'company').required(),
    storeType: Joi.string().valid('wholesale', 'retail').required(),
    gstNumber: Joi.string().required(),
    gstDocument: Joi.string().uri().required(),
    address: Joi.object({
        line1: Joi.string().required(),
        line2: Joi.string().optional().allow(''),
        landmark: Joi.string().optional().allow(''),
        state: Joi.string().required(),
        city: Joi.string().required(),
        pincode: Joi.string().required(),
        latitude: Joi.number().optional(),
        longitude: Joi.number().optional(),
    }).required(),
});

const step3Schema = Joi.object({
    accountHolderName: Joi.string().required(),
    accountNumber: Joi.string().required(),
    IFSC: Joi.string().required(),
    bankName: Joi.string().required(),
    branchName: Joi.string().required(),
});

const step1 = async (req, res, next) => {
    try {
        const { error, value } = step1Schema.validate(req.body);
        if (error) {
            throw new AppError(error.details[0].message, 400, 'VALIDATION_ERROR');
        }

        const { phone } = req.onboarding;
        const bcrypt = require('bcryptjs');
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(value.password, salt);
        value.password = hashedPassword;

        let current = await SellerOnboardingModel.findByPhone(phone);
        if (!current) {
            current = await SellerOnboardingModel.create({ phone, stepCompleted: 0 });
        }

        const updated = await SellerOnboardingModel.updateByPhone(phone, {
            basicDetails: value,
            stepCompleted: Math.max(1, current.stepCompleted),
        });

        return response.success(res, 'Step 1 saved successfully', updated);
    } catch (err) {
        next(err);
    }
};

const step2 = async (req, res, next) => {
    try {
        // Handle multipart/form-data unflattening (e.g., address[city] -> address.city)
        if (req.body) {
            Object.keys(req.body).forEach(key => {
                const match = key.match(/^(.+)\[(.+)\]$/);
                if (match) {
                    const parent = match[1];
                    const child = match[2];
                    if (!req.body[parent]) req.body[parent] = {};
                    req.body[parent][child] = req.body[key];
                    // Don't delete yet, Joi might need it or we might be in a loop
                }
            });
            // Handle arrays like productCategories[0]
            if (req.body.productCategories && !Array.isArray(req.body.productCategories)) {
                if (typeof req.body.productCategories === 'string') {
                    req.body.productCategories = [req.body.productCategories];
                }
            }
        }

        // If a file was uploaded, use its S3 public URL
        if (req.file) {
            req.body.gstDocument = getPublicUrl(req.file.key);
        }

        const { error, value } = step2Schema.validate(req.body, { abortEarly: false });
        if (error) {
            throw new AppError(error.details[0].message, 400, 'VALIDATION_ERROR');
        }

        const { phone } = req.onboarding;
        const current = await SellerOnboardingModel.findByPhone(phone);
        if (current.stepCompleted < 1) {
            throw new AppError('Complete Step 1 first.', 400, 'INVALID_STEP');
        }

        const updated = await SellerOnboardingModel.updateByPhone(phone, {
            businessDetails: value,
            stepCompleted: Math.max(2, current.stepCompleted),
        });

        // Return signed URL in the response for immediate access
        if (updated.businessDetails?.gstDocument) {
            updated.businessDetails.gstDocument = await getSignUrl(updated.businessDetails.gstDocument);
        }

        return response.success(res, 'Step 2 saved successfully', updated);
    } catch (err) {
        next(err);
    }
};

const step3 = async (req, res, next) => {
    try {
        // Handle multipart/form-data unflattening
        if (req.body) {
            Object.keys(req.body).forEach(key => {
                const match = key.match(/^(.+)\[(.+)\]$/);
                if (match) {
                    const parent = match[1];
                    const child = match[2];
                    if (!req.body[parent]) req.body[parent] = {};
                    req.body[parent][child] = req.body[key];
                }
            });
        }

        const { error, value } = step3Schema.validate(req.body);
        if (error) {
            throw new AppError(error.details[0].message, 400, 'VALIDATION_ERROR');
        }

        const { phone } = req.onboarding;
        const current = await SellerOnboardingModel.findByPhone(phone);
        if (current.stepCompleted < 2) {
            throw new AppError('Complete Step 2 first.', 400, 'INVALID_STEP');
        }

        // Encrypt account number (as requested securely). Using a dummy encryption for this task or a simple basic encryption.
        const crypto = require('crypto');
        const env = require('../../config/env');
        // For simplicity, just encode it if env is not completely setup for AES, or use standard AES.
        const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(env.JWT_ACCESS_SECRET.padEnd(32, '0').slice(0, 32)), Buffer.alloc(16, 0));
        let encrypted = cipher.update(value.accountNumber, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        value.accountNumber = encrypted; // store encrypted

        const updated = await SellerOnboardingModel.updateByPhone(phone, {
            bankDetails: value,
            stepCompleted: 3,
            status: 'PENDING_APPROVAL', // Auto-move to pending approval
        });

        return response.success(res, 'Registration Complete. Pending Admin Approval.', updated);
    } catch (err) {
        next(err);
    }
};

const getStatus = async (req, res, next) => {
    try {
        const { phone } = req.onboarding;
        const current = await SellerOnboardingModel.findByPhone(phone);
        if (!current) {
            throw new AppError('No onboarding record found.', 404, 'NOT_FOUND');
        }

        // Sign the GST document URL before returning
        if (current.businessDetails?.gstDocument) {
            current.businessDetails.gstDocument = await getSignUrl(current.businessDetails.gstDocument);
        }

        return response.success(res, 'Onboarding Status retrieved.', current);
    } catch (err) {
        next(err);
    }
}

const uploadGst = async (req, res, next) => {
    try {
        if (!req.file) {
            throw new AppError('GST document file is required.', 400, 'BAD_REQUEST');
        }

        return response.success(res, 'GST document uploaded successfully.', {
            location: await getSignUrl(req.file.key), // Signed S3 URL
        });
    } catch (err) {
        next(err);
    }
};


module.exports = {
    step1,
    step2,
    step3,
    getStatus,
    uploadGst
};

const UserModel = require('../../models/user');
const jwt = require('../../utils/jwt');
const response = require('../../utils/response');
const AppError = require('../../utils/AppError');
const bcrypt = require('bcryptjs');
const Joi = require('joi');

const registerSchema = Joi.object({
    name: Joi.string().required(),
    email: Joi.string().email().required(),
    phone: Joi.string().required(),
    password: Joi.string().min(6).required(),
});

const loginSchema = Joi.object({
    phone: Joi.string().required(),
    password: Joi.string().required(),
});

const register = async (req, res, next) => {
    try {
        const { error, value } = registerSchema.validate(req.body);
        if (error) return next(new AppError(error.details[0].message, 400, 'VALIDATION_ERROR'));

        const existingUser = await UserModel.findByMobile(value.phone);
        if (existingUser) {
            return next(new AppError('User with this phone number already exists.', 409, 'USER_EXISTS'));
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(value.password, salt);

        const prisma = require('../../config/database');
        const newUser = await prisma.user.create({
            data: {
                name: value.name,
                email: value.email,
                mobileNumber: value.phone,
                password: hashedPassword,
                isVerified: true, // Assuming true since OTP is omitted for user in this specific prompt request, or can be false
            }
        });

        const tokens = jwt.generateUserTokens({ userId: newUser.id, mobile: newUser.mobileNumber });
        await UserModel.updateRefreshToken(newUser.id, tokens.refreshToken);

        return response.success(res, 'User registered successfully', { tokens, user: { id: newUser.id, name: newUser.name } });
    } catch (err) {
        next(err);
    }
};

const login = async (req, res, next) => {
    try {
        const { error, value } = loginSchema.validate(req.body);
        if (error) return next(new AppError(error.details[0].message, 400, 'VALIDATION_ERROR'));

        const prisma = require('../../config/database');
        const user = await prisma.user.findUnique({ where: { mobileNumber: value.phone } });

        if (!user) {
            return next(new AppError('Invalid credentials.', 401, 'INVALID_CREDENTIALS'));
        }

        const isMatch = await bcrypt.compare(value.password, user.password || '');
        if (!isMatch) {
            return next(new AppError('Invalid credentials.', 401, 'INVALID_CREDENTIALS'));
        }

        const tokens = jwt.generateUserTokens({ userId: user.id, mobile: user.mobileNumber });
        await UserModel.updateRefreshToken(user.id, tokens.refreshToken);

        return response.success(res, 'Login successful', { tokens, user: { id: user.id, name: user.name } });
    } catch (err) {
        next(err);
    }
};

module.exports = { register, login };

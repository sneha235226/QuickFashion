const configService = require('../../services/admin/config.service');
const response = require('../../utils/response');
const Joi = require('joi');

const commissionRateSchema = Joi.object({
    rate: Joi.number().min(0).max(100).precision(2).required()
        .messages({
            'number.base': 'Commission rate must be a number.',
            'number.min': 'Commission rate cannot be negative.',
            'number.max': 'Commission rate cannot exceed 100%.',
        }),
});

/**
 * GET /api/admin/config/commission
 * Get the current platform commission rate.
 */
const getCommissionRate = async (req, res, next) => {
    try {
        const rate = await configService.getCommissionRate();
        return response.success(res, 'Commission rate retrieved.', { commissionRate: rate });
    } catch (err) {
        next(err);
    }
};

/**
 * PUT /api/admin/config/commission
 * Update the platform commission rate. Body: { rate: 5 }
 */
const updateCommissionRate = async (req, res, next) => {
    try {
        const { error, value } = commissionRateSchema.validate(req.body);
        if (error) return response.validationError(res, error);

        await configService.setCommissionRate(value.rate);
        return response.success(res, `Commission rate updated to ${value.rate}%.`, { commissionRate: value.rate });
    } catch (err) {
        next(err);
    }
};

module.exports = { getCommissionRate, updateCommissionRate };

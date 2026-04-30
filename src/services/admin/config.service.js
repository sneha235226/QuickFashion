const prisma = require('../../config/database');

const COMMISSION_KEY = 'COMMISSION_RATE';

/**
 * Get the global platform commission rate.
 * Returns the rate as a number (e.g. 5 means 5%).
 * Defaults to 0 if not yet configured.
 */
const getCommissionRate = async () => {
    const config = await prisma.globalConfig.findUnique({
        where: { key: COMMISSION_KEY },
    });
    return config ? Number(config.value) : 4;
};

/**
 * Set (upsert) the global platform commission rate.
 * @param {number} rate — e.g. 5 for 5%
 */
const setCommissionRate = async (rate) => {
    return prisma.globalConfig.upsert({
        where: { key: COMMISSION_KEY },
        update: { value: rate },
        create: { key: COMMISSION_KEY, value: rate },
    });
};

module.exports = { getCommissionRate, setCommissionRate };

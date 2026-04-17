const prisma = require('../config/database');

// Create OTP
const create = (mobileNumber, role, requestId, expiresAt) =>
    prisma.oTP.create({
        data: {
            mobileNumber: mobileNumber,
            role,
            requestId,
            expiresAt,
        },
    });

// Find active OTP
const findActiveByMobile = (mobileNumber, role) =>
    prisma.oTP.findFirst({
        where: {
            mobileNumber: mobileNumber,
            role,
            used: false,
            expiresAt: { gt: new Date() }
        },
        orderBy: { createdAt: 'desc' },
    });

// Find by requestId
const findByRequestId = (requestId) =>
    prisma.oTP.findFirst({
        where: { requestId },
    });

// Mark OTP as verified
const markVerified = (id) =>
    prisma.oTP.update({
        where: { id },
        data: {
            verified: true,
            used: true
        },
    });

module.exports = {
    create,
    findActiveByMobile,
    findByRequestId,
    markVerified
};
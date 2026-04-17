const prisma = require('../config/database');

const findByPhone = (phone) =>
    prisma.sellerOnboarding.findUnique({ where: { phone } });

const create = (data) =>
    prisma.sellerOnboarding.create({ data });

const updateByPhone = (phone, data) =>
    prisma.sellerOnboarding.update({ where: { phone }, data });

const getPendingApproval = () =>
    prisma.sellerOnboarding.findMany({ where: { status: 'PENDING_APPROVAL' } });

const findById = (id) =>
    prisma.sellerOnboarding.findUnique({ where: { id } });

const updateStatus = (id, status, rejectionReason = null) =>
    prisma.sellerOnboarding.update({
        where: { id },
        data: { status, rejectionReason },
    });

module.exports = {
    findByPhone,
    create,
    updateByPhone,
    getPendingApproval,
    findById,
    updateStatus,
};

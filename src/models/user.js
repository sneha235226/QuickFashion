const prisma = require('../config/database');

const findByMobile = (mobileNumber) =>
  prisma.user.findUnique({ where: { mobileNumber } });

const findById = (id) =>
  prisma.user.findUnique({ where: { id } });

const create = (mobileNumber) =>
  prisma.user.create({
    data: { mobileNumber, isVerified: true },
  });

const updateRefreshToken = (id, refreshToken) =>
  prisma.user.update({
    where: { id },
    data: { refreshToken },
  });

module.exports = { findByMobile, findById, create, updateRefreshToken };

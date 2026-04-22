const prisma = require('../config/database');

const findByMobile = (mobileNumber) =>
  prisma.user.findUnique({ where: { mobileNumber } });

const findById = (id) =>
  prisma.user.findUnique({ where: { id } });

const create = (data) =>
  prisma.user.create({
    data: {
      mobileNumber: data.mobileNumber,
      name: data.name,
      email: data.email,
      password: data.password,
      isVerified: true
    },
  });

const updateRefreshToken = (id, refreshToken) =>
  prisma.user.update({
    where: { id },
    data: { refreshToken },
  });

module.exports = { findByMobile, findById, create, updateRefreshToken };

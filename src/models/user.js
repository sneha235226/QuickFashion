const prisma = require('../config/database');

const findByMobile = (mobileNumber) =>
  prisma.user.findUnique({ where: { mobileNumber } });

const findById = (id) =>
  prisma.user.findUnique({ where: { id } });

const findByIdentifier = (identifier) =>
  prisma.user.findFirst({
    where: {
      OR: [
        { email: identifier },
        { mobileNumber: identifier }
      ]
    }
  });

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

/**
 * Find a user by their password reset token.
 */
const findByResetToken = (token) =>
  prisma.user.findFirst({
    where: { passwordResetToken: token },
  });

/**
 * Store or clear a password reset token + expiry on a user.
 */
const updatePasswordReset = (id, data) =>
  prisma.user.update({
    where: { id },
    data,
  });

module.exports = {
  findByMobile,
  findById,
  findByIdentifier,
  create,
  updateRefreshToken,
  findByResetToken,
  updatePasswordReset,
};

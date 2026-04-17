/**
 * Admin Model — data access layer for the Admin table.
 */

const prisma = require('../config/database');

const findByEmail = (email) =>
  prisma.admin.findUnique({ where: { email } });

const findByUsername = (username) =>
  prisma.admin.findUnique({ where: { username } });

const findById = (id) =>
  prisma.admin.findUnique({ where: { id } });

const createAdmin = (data) =>
  prisma.admin.create({ data });

const updateAdmin = (id, data) =>
  prisma.admin.update({ where: { id }, data });

module.exports = {
  findByEmail,
  findByUsername,
  findById,
  createAdmin,
  updateAdmin,
};

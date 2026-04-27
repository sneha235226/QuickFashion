const bcrypt = require('bcryptjs');
const prisma = require('../src/config/database');

async function main() {
  const email = 'admin@quickfashion.com';
  const password = 'password123';
  const passwordHash = await bcrypt.hash(password, 12);
  
  const admin = await prisma.admin.findUnique({ where: { email } });
  
  if (admin) {
    await prisma.admin.update({
      where: { email },
      data: { passwordHash }
    });
    console.log('Successfully updated password for admin@quickfashion.com');
  } else {
    await prisma.admin.create({
      data: {
        username: 'admin',
        email: email,
        passwordHash: passwordHash
      }
    });
    console.log('Successfully created admin@quickfashion.com');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());

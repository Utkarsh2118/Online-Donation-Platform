const User = require('../models/User');

const seedDefaultAdmin = async () => {
  const adminEmail = process.env.DEFAULT_ADMIN_EMAIL || process.env.ADMIN_EMAIL;
  const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;
  const adminName = process.env.DEFAULT_ADMIN_NAME || process.env.ADMIN_NAME || 'Platform Admin';
  const shouldSyncCredentials = String(process.env.SYNC_DEFAULT_ADMIN_CREDENTIALS || '').toLowerCase() === 'true';

  if (!adminEmail || !adminPassword) {
    console.warn('Default admin seeding skipped: missing admin email/password env vars');
    return;
  }

  const existingAdmin = await User.findOne({ email: adminEmail.toLowerCase().trim() });

  if (existingAdmin) {
    if (shouldSyncCredentials) {
      existingAdmin.name = adminName;
      existingAdmin.password = adminPassword;
      existingAdmin.role = 'admin';
      await existingAdmin.save();
      console.log('Default admin account synchronized from environment');
    }

    return;
  }

  await User.create({
    name: adminName,
    email: adminEmail,
    password: adminPassword,
    role: 'admin'
  });

  console.log('Default admin account created');
};

module.exports = seedDefaultAdmin;

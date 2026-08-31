const { User } = require('../models');

/**
 * Makes sure at least one admin user exists, so the site's own login is
 * usable from a fresh deploy without a manual DB step.
 *
 * Controlled by ADMIN_ID_NUMBER (required to do anything) and optional
 * ADMIN_NAME. If a user with that ID already exists, it's promoted to
 * admin rather than duplicated; otherwise one is created.
 */
async function ensureAdmin() {
  const idNumber = process.env.ADMIN_ID_NUMBER;
  if (!idNumber) {
    console.log('ℹ️  ADMIN_ID_NUMBER not set — skipping admin bootstrap');
    return;
  }

  const [admin, created] = await User.findOrCreate({
    where: { idNumber },
    defaults: { name: process.env.ADMIN_NAME || 'מנהלת מערכת', role: 'admin' },
  });

  if (!created && admin.role !== 'admin') {
    await admin.update({ role: 'admin' });
    console.log(`✅ Promoted existing user ${idNumber} to admin`);
  } else if (created) {
    console.log(`✅ Created admin user ${idNumber}`);
  }
}

module.exports = ensureAdmin;

const bcrypt = require('bcryptjs');
const { User } = require('../models');

/**
 * Makes sure at least one admin user exists, so the site's own login is
 * usable from a fresh deploy without a manual DB step.
 *
 * Controlled by ADMIN_ID_NUMBER (required to do anything), optional
 * ADMIN_NAME, and optional ADMIN_PASSWORD. If a user with that ID already
 * exists, it's promoted to admin rather than duplicated; otherwise one is
 * created. When ADMIN_PASSWORD is set, it's (re-)hashed into that admin's
 * password on every startup, so rotating the Railway env var is enough to
 * change it - no DB access needed. Leaving ADMIN_PASSWORD unset never
 * clears an existing password.
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

  if (process.env.ADMIN_PASSWORD) {
    admin.password = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
    await admin.save();
    console.log(`✅ Admin ${idNumber} password set from ADMIN_PASSWORD`);
  } else if (!admin.password) {
    console.log(`⚠️  Admin ${idNumber} has no password set — set ADMIN_PASSWORD to enable login`);
  }
}

module.exports = ensureAdmin;

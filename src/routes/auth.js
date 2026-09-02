const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User } = require('../models');
const { validateIdNumber } = require('../utils/validators');

// Authenticate with ID number + password. Admin-website login only - the
// phone line identifies students by ID number alone (see routes/pbx.js),
// so only admin accounts ever have a password set.
router.post('/login', async (req, res) => {
  try {
    const { idNumber, password } = req.body;

    if (!idNumber || !validateIdNumber(idNumber)) {
      return res.status(400).json({ error: 'Invalid ID number format' });
    }
    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    const user = await User.findOne({ where: { idNumber } });

    // Same generic error whether the ID doesn't exist, isn't an admin, has
    // no password set yet, or the password is wrong - don't leak which.
    if (!user || user.role !== 'admin' || !user.password || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid ID number or password' });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'User account is inactive' });
    }

    const token = jwt.sign(
      { userId: user.id, idNumber: user.idNumber, role: user.role },
      process.env.JWT_SECRET || 'secret-key',
      { expiresIn: process.env.JWT_EXPIRATION || '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        idNumber: user.idNumber,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Verify token
router.get('/verify', (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'secret-key'
    );
    res.json({ valid: true, user: decoded });
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
});

module.exports = router;

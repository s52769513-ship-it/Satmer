const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { validateIdNumber } = require('../utils/validators');

// Authenticate with ID number
router.post('/login', async (req, res) => {
  try {
    const { idNumber } = req.body;

    if (!idNumber || !validateIdNumber(idNumber)) {
      return res.status(400).json({ error: 'Invalid ID number format' });
    }

    let user = await User.findOne({ where: { idNumber } });

    if (!user) {
      // Create new user if not exists
      user = await User.create({
        idNumber,
        name: `User ${idNumber}`,
      });
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

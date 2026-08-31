const express = require('express');
const router = express.Router();
const { User } = require('../models');
const { authenticateToken } = require('../middleware/auth');

// Get current user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.userId, {
      attributes: { exclude: ['createdAt', 'updatedAt'] },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update user notification preferences
router.put('/notification-preferences', authenticateToken, async (req, res) => {
  try {
    const { notificationDay, notificationHour } = req.body;

    if (notificationDay && !['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].includes(notificationDay)) {
      return res.status(400).json({ error: 'Invalid day' });
    }

    if (notificationHour !== undefined && (notificationHour < 0 || notificationHour > 23)) {
      return res.status(400).json({ error: 'Hour must be 0-23' });
    }

    await User.update(
      { notificationDay, notificationHour },
      { where: { id: req.user.userId } }
    );

    const user = await User.findByPk(req.user.userId);
    res.json({
      success: true,
      message: 'Notification preferences updated',
      preferences: {
        notificationDay: user.notificationDay,
        notificationHour: user.notificationHour,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// Get user's notification preferences
router.get('/notification-preferences', authenticateToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.userId, {
      attributes: ['notificationDay', 'notificationHour'],
    });

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
});

module.exports = router;

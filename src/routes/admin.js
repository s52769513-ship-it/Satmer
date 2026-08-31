const express = require('express');
const router = express.Router();
const { User, Activity, Completion, ActivityLog } = require('../models');
const { authenticateToken, authorizeAdmin } = require('../middleware/auth');

// Get all users (admin only)
router.get('/users', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['createdAt', 'updatedAt'] },
      order: [['name', 'ASC']],
    });

    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Add user (admin only)
router.post('/users', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const { name, idNumber } = req.body;

    if (!name || !idNumber) {
      return res.status(400).json({ error: 'Name and ID number required' });
    }

    const existingUser = await User.findOne({ where: { idNumber } });
    if (existingUser) {
      return res.status(409).json({ error: 'User with this ID already exists' });
    }

    const user = await User.create({ name, idNumber });
    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Deactivate user (admin only)
router.put('/users/:userId/deactivate', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await user.update({ isActive: false });
    res.json({ success: true, message: 'User deactivated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to deactivate user' });
  }
});

// Activate user (admin only)
router.put('/users/:userId/activate', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await user.update({ isActive: true });
    res.json({ success: true, message: 'User activated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to activate user' });
  }
});

// Get activity logs (admin only)
router.get('/activity-logs', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const logs = await ActivityLog.findAll({
      where: {
        createdAt: { [require('sequelize').Op.gte]: startDate },
      },
      include: [{ model: User, as: 'user', attributes: ['name', 'idNumber'] }],
      order: [['createdAt', 'DESC']],
    });

    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// Reset yearly data (admin only)
router.post('/reset-yearly-data', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    // This would be called on 1st of Sivan (Hebrew calendar)
    // For now, we just clear activities and completions

    const confirmed = req.body.confirmed === true;
    if (!confirmed) {
      return res.status(400).json({
        error: 'Confirmation required',
        message: 'This will reset all yearly data. Send confirmed: true to proceed.'
      });
    }

    await Activity.truncate();
    await Completion.truncate();
    await User.update({ lastActivityUpdate: null }, { where: {} });

    res.json({ success: true, message: 'Yearly data reset successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reset data' });
  }
});

// Get system statistics (admin only)
router.get('/statistics', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const totalUsers = await User.count();
    const activeUsers = await User.count({ where: { isActive: true } });
    const totalActivities = await Activity.count();
    const totalCompletions = await Completion.count();

    res.json({
      users: {
        total: totalUsers,
        active: activeUsers,
        inactive: totalUsers - activeUsers,
      },
      activities: totalActivities,
      completions: totalCompletions,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

module.exports = router;

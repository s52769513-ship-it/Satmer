const express = require('express');
const router = express.Router();
const { Activity, User } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const { getWeekStartDate, getWeekNumber } = require('../utils/validators');

// Get user's activities (with optional filters)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { month, year } = req.query;
    const userId = req.user.userId;

    const where = { userId };

    if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      where.weekStartDate = {
        [require('sequelize').Op.between]: [startDate, endDate],
      };
    }

    const activities = await Activity.findAll({
      where,
      order: [['weekStartDate', 'DESC']],
    });

    res.json(activities);
  } catch (error) {
    console.error('Get activities error:', error);
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
});

// Get current week's activity
router.get('/current-week', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const weekStart = getWeekStartDate();

    const activity = await Activity.findOne({
      where: { userId, weekStartDate: weekStart },
    });

    res.json({
      weekNumber: getWeekNumber(),
      weekStart,
      activity: activity || null,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

// Get activity statistics
router.get('/statistics', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const activities = await Activity.findAll({ where: { userId } });

    const stats = {
      totalWeeks: activities.length,
      participated: activities.filter(a => a.participated).length,
      notParticipated: activities.filter(a => !a.participated).length,
      totalPoints: activities.reduce((sum, a) => sum + (a.points || 0), 0),
      participationRate: activities.length > 0
        ? ((activities.filter(a => a.participated).length / activities.length) * 100).toFixed(1)
        : 0,
    };

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

module.exports = router;

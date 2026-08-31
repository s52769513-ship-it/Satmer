const express = require('express');
const router = express.Router();
const { Completion } = require('../models');
const { authenticateToken } = require('../middleware/auth');

// Get user's completions
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { year } = req.query;
    const userId = req.user.userId;
    const currentYear = year || new Date().getFullYear();

    const completions = await Completion.findAll({
      where: { userId, year: currentYear },
      order: [['completionNumber', 'ASC']],
    });

    res.json({
      year: currentYear,
      total: completions.length,
      completions,
    });
  } catch (error) {
    console.error('Get completions error:', error);
    res.status(500).json({ error: 'Failed to fetch completions' });
  }
});

// Get completion by number
router.get('/:number', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { number } = req.params;

    const completion = await Completion.findOne({
      where: { userId, completionNumber: number },
    });

    if (!completion) {
      return res.status(404).json({ error: 'Completion not found' });
    }

    res.json(completion);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch completion' });
  }
});

// Get completion statistics
router.get('/statistics/summary', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const currentYear = new Date().getFullYear();

    const completions = await Completion.findAll({
      where: { userId, year: currentYear },
    });

    const statsByMonth = {};
    completions.forEach(c => {
      statsByMonth[c.month] = (statsByMonth[c.month] || 0) + 1;
    });

    res.json({
      year: currentYear,
      total: completions.length,
      totalPoints: completions.reduce((sum, c) => sum + (c.points || 0), 0),
      byMonth: statsByMonth,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

module.exports = router;

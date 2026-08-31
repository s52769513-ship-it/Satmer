const express = require('express');
const router = express.Router();
const { User, Activity, Completion, ActivityLog } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const { getWeekNumber, getWeekStartDate, canUpdateActivityThisWeek, canUpdateCompletionThisMonth } = require('../utils/validators');

// Extension 1: Weekly Activity Update
router.post('/extension-1/status', authenticateToken, async (req, res) => {
  try {
    const { participated } = req.body;
    const userId = req.user.userId;

    const weekStart = getWeekStartDate();
    const weekNumber = getWeekNumber();

    // Check if already updated this week
    const lastUpdate = await User.findByPk(userId);
    if (lastUpdate.lastActivityUpdate && !canUpdateActivityThisWeek(lastUpdate.lastActivityUpdate)) {
      await ActivityLog.create({
        userId,
        action: 'extension_1_activity_update',
        extension: 1,
        status: 'failed',
        details: { reason: 'Already updated this week' },
      });

      return res.status(429).json({
        error: 'Already updated activity this week',
        message: 'You can update again next week after Shabbat',
      });
    }

    // Find or create activity record
    let activity = await Activity.findOne({
      where: { userId, weekStartDate: weekStart },
    });

    if (!activity) {
      activity = await Activity.create({
        userId,
        weekStartDate: weekStart,
        weekNumber,
        participated: participated === true || participated === '1',
        points: participated ? 10 : 0,
      });
    } else {
      activity.participated = participated === true || participated === '1';
      activity.points = activity.participated ? 10 : 0;
      await activity.save();
    }

    // Update user's last activity update time
    await User.update({ lastActivityUpdate: new Date() }, { where: { id: userId } });

    // Log the action
    await ActivityLog.create({
      userId,
      action: 'extension_1_activity_update',
      extension: 1,
      status: 'success',
      details: { participated: activity.participated, points: activity.points },
    });

    res.json({
      success: true,
      message: 'Activity updated successfully',
      activity: {
        week: weekNumber,
        participated: activity.participated,
        points: activity.points,
      },
    });
  } catch (error) {
    console.error('Extension 1 error:', error);
    res.status(500).json({ error: 'Failed to update activity' });
  }
});

// Extension 1: Get activity status
router.get('/extension-1/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const weekStart = getWeekStartDate();

    const activity = await Activity.findOne({
      where: { userId, weekStartDate: weekStart },
    });

    const user = await User.findByPk(userId);

    res.json({
      currentWeek: getWeekNumber(),
      hasUpdated: !!activity,
      participated: activity?.participated || false,
      lastUpdateTime: user.lastActivityUpdate,
      message: activity
        ? `You ${activity.participated ? 'participated' : 'did not participate'} in this week's activity`
        : 'No update for this week yet. Press 1 to update.',
    });
  } catch (error) {
    console.error('Extension 1 status error:', error);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

// Extension 2: Completion Update
router.post('/extension-2/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const today = new Date();

    // Check if already updated this month
    const lastCompletion = await Completion.findOne({
      where: { userId },
      order: [['createdAt', 'DESC']],
      limit: 1,
    });

    if (lastCompletion && !canUpdateCompletionThisMonth(lastCompletion.createdAt)) {
      await ActivityLog.create({
        userId,
        action: 'extension_2_completion_update',
        extension: 2,
        status: 'failed',
        details: { reason: 'Already updated this month' },
      });

      return res.status(429).json({
        error: 'Already updated completion this month',
        message: 'You can update again next month',
      });
    }

    // Get next completion number
    const completionCount = await Completion.count({ where: { userId } });
    const nextNumber = completionCount + 1;

    // Create completion record
    const completion = await Completion.create({
      userId,
      completionNumber: nextNumber,
      month: today.getMonth() + 1,
      year: today.getFullYear(),
      points: 20,
      completedAt: today,
    });

    // Log the action
    await ActivityLog.create({
      userId,
      action: 'extension_2_completion_update',
      extension: 2,
      status: 'success',
      details: { completionNumber: completion.completionNumber, points: completion.points },
    });

    res.json({
      success: true,
      message: 'Completion recorded successfully',
      completion: {
        number: completion.completionNumber,
        month: completion.month,
        points: completion.points,
      },
    });
  } catch (error) {
    console.error('Extension 2 error:', error);
    res.status(500).json({ error: 'Failed to record completion' });
  }
});

// Extension 2: Get completion status
router.get('/extension-2/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const completionCount = await Completion.count({ where: { userId } });

    res.json({
      totalCompletions: completionCount,
      nextNumber: completionCount + 1,
      message: `You have completed ${completionCount} so far this year. Press 1 to record a new completion.`,
    });
  } catch (error) {
    console.error('Extension 2 status error:', error);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

// Extension 3: View points and totals
router.get('/extension-3/summary', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const activities = await Activity.findAll({ where: { userId } });
    const completions = await Completion.findAll({ where: { userId } });

    const activityPoints = activities.reduce((sum, a) => sum + (a.points || 0), 0);
    const completionPoints = completions.reduce((sum, c) => sum + (c.points || 0), 0);
    const totalPoints = activityPoints + completionPoints;

    const participationCount = activities.filter(a => a.participated).length;

    res.json({
      summary: {
        activitiesParticipated: participationCount,
        activityPoints,
        completions: completions.length,
        completionPoints,
        totalPoints,
      },
      message: `Your achievements: ${participationCount} activities, ${completions.length} completions, ${totalPoints} total points`,
    });
  } catch (error) {
    console.error('Extension 3 error:', error);
    res.status(500).json({ error: 'Failed to get summary' });
  }
});

module.exports = router;

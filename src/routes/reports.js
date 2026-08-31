const express = require('express');
const router = express.Router();
const { Activity, Completion, User } = require('../models');
const { authenticateToken, authorizeAdmin } = require('../middleware/auth');

// Download weekly report
router.get('/weekly', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const { week, year } = req.query;
    const currentYear = year || new Date().getFullYear();

    const activities = await Activity.findAll({
      where: { weekNumber: week, userId: { [require('sequelize').Op.any]: [] } },
      include: [{ model: User, as: 'user', attributes: ['name', 'idNumber'] }],
    });

    // Generate CSV
    const csv = generateActivityCSV(activities);

    res.header('Content-Type', 'text/csv');
    res.header('Content-Disposition', `attachment; filename="activities_week_${week}_${currentYear}.csv"`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Download monthly report
router.get('/monthly', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const { month, year } = req.query;
    const currentYear = year || new Date().getFullYear();
    const currentMonth = month || new Date().getMonth() + 1;

    const completions = await Completion.findAll({
      where: { month: currentMonth, year: currentYear },
      include: [{ model: User, as: 'user', attributes: ['name', 'idNumber'] }],
      order: [['completedAt', 'ASC']],
    });

    // Generate CSV
    const csv = generateCompletionCSV(completions, currentMonth, currentYear);

    res.header('Content-Type', 'text/csv');
    res.header('Content-Disposition', `attachment; filename="completions_${currentMonth}_${currentYear}.csv"`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Download yearly report
router.get('/yearly', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const { year } = req.query;
    const currentYear = year || new Date().getFullYear();

    const users = await User.findAll({
      include: [
        { model: Activity, as: 'activities', where: {} },
        { model: Completion, as: 'completions', where: { year: currentYear } },
      ],
    });

    // Generate comprehensive CSV
    const csv = generateYearlyCSV(users, currentYear);

    res.header('Content-Type', 'text/csv');
    res.header('Content-Disposition', `attachment; filename="yearly_report_${currentYear}.csv"`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Helper functions
function generateActivityCSV(activities) {
  const headers = ['Name', 'ID Number', 'Week', 'Parsha', 'Participated', 'Points'];
  const rows = activities.map(a => [
    a.user.name,
    a.user.idNumber,
    a.weekNumber,
    a.parashaName || '',
    a.participated ? 'Yes' : 'No',
    a.points,
  ]);

  return generateCSV(headers, rows);
}

function generateCompletionCSV(completions, month, year) {
  const headers = ['Name', 'ID Number', 'Completion #', 'Month', 'Year', 'Points', 'Date'];
  const rows = completions.map(c => [
    c.user.name,
    c.user.idNumber,
    c.completionNumber,
    month,
    year,
    c.points,
    new Date(c.completedAt).toLocaleDateString('he-IL'),
  ]);

  return generateCSV(headers, rows);
}

function generateYearlyCSV(users, year) {
  const headers = ['Name', 'ID Number', 'Total Activities', 'Participated', 'Activity Points', 'Completions', 'Completion Points', 'Total Points'];

  const rows = users.map(u => {
    const participated = u.activities.filter(a => a.participated).length;
    const activityPoints = u.activities.reduce((sum, a) => sum + (a.points || 0), 0);
    const completions = u.completions.length;
    const completionPoints = u.completions.reduce((sum, c) => sum + (c.points || 0), 0);
    const totalPoints = activityPoints + completionPoints;

    return [
      u.name,
      u.idNumber,
      u.activities.length,
      participated,
      activityPoints,
      completions,
      completionPoints,
      totalPoints,
    ];
  });

  return generateCSV(headers, rows);
}

function generateCSV(headers, rows) {
  const csvHeaders = headers.map(h => `"${h}"`).join(',');
  const csvRows = rows.map(row =>
    row.map(cell => `"${cell}"`).join(',')
  ).join('\n');

  return `${csvHeaders}\n${csvRows}`;
}

module.exports = router;

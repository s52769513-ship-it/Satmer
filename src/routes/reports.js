const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { Activity, Completion, User } = require('../models');
const { authenticateToken, authorizeAdmin } = require('../middleware/auth');
const { getHebrewDateString } = require('../utils/hebrew-date');

// ---- shared row builders (used by both preview and CSV download) ----

async function weeklyRows({ week, year, search, participated }) {
  const where = {};
  if (week) where.weekNumber = week;
  if (year) {
    const start = new Date(Number(year), 0, 1);
    const end = new Date(Number(year) + 1, 0, 1);
    where.weekStartDate = { [Op.gte]: start, [Op.lt]: end };
  }
  if (participated === 'yes') where.participated = true;
  if (participated === 'no') where.participated = false;

  const userWhere = search ? { [Op.or]: [{ name: { [Op.iLike]: `%${search}%` } }, { idNumber: { [Op.iLike]: `%${search}%` } }] } : undefined;

  const activities = await Activity.findAll({
    where,
    include: [{ model: User, as: 'user', attributes: ['name', 'idNumber'], where: userWhere }],
    order: [[{ model: User, as: 'user' }, 'name', 'ASC']],
  });

  return Promise.all(activities.map(async a => ({
    name: a.user.name,
    idNumber: a.user.idNumber,
    week: a.weekNumber,
    parasha: a.parashaName || '',
    hebrewDate: await getHebrewDateString(a.weekStartDate),
    participated: a.participated,
    points: a.points,
  })));
}

async function monthlyRows({ month, year, search }) {
  const currentYear = year || new Date().getFullYear();
  const currentMonth = month || new Date().getMonth() + 1;

  const userWhere = search ? { [Op.or]: [{ name: { [Op.iLike]: `%${search}%` } }, { idNumber: { [Op.iLike]: `%${search}%` } }] } : undefined;

  const completions = await Completion.findAll({
    where: { month: currentMonth, year: currentYear },
    include: [{ model: User, as: 'user', attributes: ['name', 'idNumber'], where: userWhere }],
    order: [['completedAt', 'ASC']],
  });

  return Promise.all(completions.map(async c => ({
    name: c.user.name,
    idNumber: c.user.idNumber,
    completionNumber: c.completionNumber,
    month: currentMonth,
    year: currentYear,
    points: c.points,
    date: c.completedAt,
    hebrewDate: await getHebrewDateString(c.completedAt),
  })));
}

async function yearlyRows({ year, search, minPoints }) {
  const currentYear = year || new Date().getFullYear();
  const userWhere = search ? { [Op.or]: [{ name: { [Op.iLike]: `%${search}%` } }, { idNumber: { [Op.iLike]: `%${search}%` } }] } : {};

  const users = await User.findAll({
    where: userWhere,
    include: [
      { model: Activity, as: 'activities', required: false },
      { model: Completion, as: 'completions', where: { year: currentYear }, required: false },
    ],
    order: [['name', 'ASC']],
  });

  const rows = users.map(u => {
    const participated = u.activities.filter(a => a.participated).length;
    const activityPoints = u.activities.reduce((sum, a) => sum + (a.points || 0), 0);
    const completions = u.completions.length;
    const completionPoints = u.completions.reduce((sum, c) => sum + (c.points || 0), 0);
    return {
      name: u.name,
      idNumber: u.idNumber,
      totalActivities: u.activities.length,
      participated,
      activityPoints,
      completions,
      completionPoints,
      totalPoints: activityPoints + completionPoints,
    };
  });

  return minPoints ? rows.filter(r => r.totalPoints >= Number(minPoints)) : rows;
}

// ---- preview endpoints (JSON, for the admin UI table) ----

router.get('/weekly/preview', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    res.json(await weeklyRows(req.query));
  } catch (error) {
    console.error('Weekly preview error:', error);
    res.status(500).json({ error: 'Failed to load preview' });
  }
});

router.get('/monthly/preview', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    res.json(await monthlyRows(req.query));
  } catch (error) {
    console.error('Monthly preview error:', error);
    res.status(500).json({ error: 'Failed to load preview' });
  }
});

router.get('/yearly/preview', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    res.json(await yearlyRows(req.query));
  } catch (error) {
    console.error('Yearly preview error:', error);
    res.status(500).json({ error: 'Failed to load preview' });
  }
});

// ---- CSV download endpoints ----

router.get('/weekly', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const rows = await weeklyRows(req.query);
    const csv = generateCSV(
      ['שם', 'תעודת זהות', 'שבוע', 'פרשה', 'תאריך עברי', 'השתתפה', 'נקודות'],
      rows.map(r => [r.name, r.idNumber, r.week, r.parasha, r.hebrewDate, r.participated ? 'כן' : 'לא', r.points])
    );
    sendCsv(res, csv, `activities_week_${req.query.week}_${req.query.year || new Date().getFullYear()}.csv`);
  } catch (error) {
    console.error('Weekly report error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

router.get('/monthly', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const rows = await monthlyRows(req.query);
    const csv = generateCSV(
      ['שם', 'תעודת זהות', 'מס\' השלמה', 'חודש', 'שנה', 'נקודות', 'תאריך עברי'],
      rows.map(r => [r.name, r.idNumber, r.completionNumber, r.month, r.year, r.points, r.hebrewDate])
    );
    sendCsv(res, csv, `completions_${req.query.month}_${req.query.year || new Date().getFullYear()}.csv`);
  } catch (error) {
    console.error('Monthly report error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

router.get('/yearly', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const rows = await yearlyRows(req.query);
    const csv = generateCSV(
      ['שם', 'תעודת זהות', 'סה"כ שבועות', 'השתתפויות', 'נקודות פעילות', 'השלמות', 'נקודות השלמה', 'סה"כ נקודות'],
      rows.map(r => [r.name, r.idNumber, r.totalActivities, r.participated, r.activityPoints, r.completions, r.completionPoints, r.totalPoints])
    );
    sendCsv(res, csv, `yearly_report_${req.query.year || new Date().getFullYear()}.csv`);
  } catch (error) {
    console.error('Yearly report error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

function sendCsv(res, csv, filename) {
  // BOM so Excel opens Hebrew UTF-8 correctly instead of mangling it.
  res.header('Content-Type', 'text/csv; charset=utf-8');
  res.header('Content-Disposition', `attachment; filename="${filename}"`);
  res.send('﻿' + csv);
}

function generateCSV(headers, rows) {
  const csvHeaders = headers.map(h => `"${h}"`).join(',');
  const csvRows = rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  return `${csvHeaders}\n${csvRows}`;
}

module.exports = router;

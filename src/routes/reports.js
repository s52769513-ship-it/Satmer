const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { Activity, Completion, User } = require('../models');
const { authenticateToken, authorizeAdmin } = require('../middleware/auth');
const { getHebrewDateString, getHebrewYear, listHebrewMonths } = require('../utils/hebrew-date');

// ---- shared row builders (used by both preview and CSV download) ----
//
// All three reports filter by the Hebrew calendar concept the spec asked
// for - a parasha for the weekly report, a Hebrew month for the monthly
// one, a Hebrew year for the yearly one - rather than Gregorian week/month
// numbers.

async function weeklyRows({ parasha, hebrewYear, search, participated }) {
  const where = {};
  if (parasha) where.parashaName = parasha;
  if (hebrewYear) where.hebrewYear = hebrewYear;
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
    parasha: a.parashaName || '',
    hebrewYear: a.hebrewYear,
    hebrewDate: await getHebrewDateString(a.weekStartDate),
    participated: a.participated,
    points: a.points,
  })));
}

async function monthlyRows({ hebrewMonth, hebrewYear, search }) {
  const where = {};
  if (hebrewMonth) where.hebrewMonth = hebrewMonth;
  if (hebrewYear) where.hebrewYear = hebrewYear;

  const userWhere = search ? { [Op.or]: [{ name: { [Op.iLike]: `%${search}%` } }, { idNumber: { [Op.iLike]: `%${search}%` } }] } : undefined;

  const completions = await Completion.findAll({
    where,
    include: [{ model: User, as: 'user', attributes: ['name', 'idNumber'], where: userWhere }],
    order: [['completedAt', 'ASC']],
  });

  return Promise.all(completions.map(async c => ({
    name: c.user.name,
    idNumber: c.user.idNumber,
    completionNumber: c.completionNumber,
    hebrewMonth: c.hebrewMonth,
    hebrewYear: c.hebrewYear,
    points: c.points,
    date: c.completedAt,
    hebrewDate: await getHebrewDateString(c.completedAt),
  })));
}

async function yearlyRows({ hebrewYear, search, minPoints }) {
  const currentYear = hebrewYear || await getHebrewYear();
  const userWhere = search ? { [Op.or]: [{ name: { [Op.iLike]: `%${search}%` } }, { idNumber: { [Op.iLike]: `%${search}%` } }] } : {};

  const users = await User.findAll({
    where: userWhere,
    include: [
      { model: Activity, as: 'activities', where: { hebrewYear: currentYear }, required: false },
      { model: Completion, as: 'completions', where: { hebrewYear: currentYear }, required: false },
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

// ---- dropdown option endpoints ----

// Distinct parasha names actually recorded, newest-used first, plus the
// current Hebrew year (for the year filter alongside it).
router.get('/filter-options/weekly', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const rows = await Activity.findAll({
      attributes: ['parashaName'],
      where: { parashaName: { [Op.ne]: null } },
      group: ['parashaName'],
      raw: true,
    });
    res.json({ parashot: rows.map(r => r.parashaName).sort(), currentHebrewYear: await getHebrewYear() });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load filter options' });
  }
});

// All Hebrew month names for a given (or current) Hebrew year, in calendar order.
router.get('/filter-options/monthly', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const currentHebrewYear = await getHebrewYear();
    const year = req.query.hebrewYear ? Number(req.query.hebrewYear) : currentHebrewYear;
    res.json({ months: await listHebrewMonths(year), currentHebrewYear });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load filter options' });
  }
});

router.get('/filter-options/yearly', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    res.json({ currentHebrewYear: await getHebrewYear() });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load filter options' });
  }
});

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
      ['שם', 'תעודת זהות', 'פרשה', 'שנה עברית', 'תאריך עברי', 'השתתפה', 'נקודות'],
      rows.map(r => [r.name, r.idNumber, r.parasha, r.hebrewYear, r.hebrewDate, r.participated ? 'כן' : 'לא', r.points])
    );
    sendCsv(res, csv, `activities_${(req.query.parasha || 'all').replace(/\s+/g, '_')}.csv`);
  } catch (error) {
    console.error('Weekly report error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

router.get('/monthly', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const rows = await monthlyRows(req.query);
    const csv = generateCSV(
      ['שם', 'תעודת זהות', 'מס\' השלמה', 'חודש עברי', 'שנה עברית', 'נקודות', 'תאריך עברי'],
      rows.map(r => [r.name, r.idNumber, r.completionNumber, r.hebrewMonth, r.hebrewYear, r.points, r.hebrewDate])
    );
    sendCsv(res, csv, `completions_${req.query.hebrewMonth || 'all'}_${req.query.hebrewYear || ''}.csv`);
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
    const year = req.query.hebrewYear || await getHebrewYear();
    sendCsv(res, csv, `yearly_report_${year}.csv`);
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

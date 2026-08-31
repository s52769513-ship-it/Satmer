const express = require('express');
const router = express.Router();
const multer = require('multer');
const ExcelJS = require('exceljs');
const { User, Activity, Completion, ActivityLog } = require('../models');
const { authenticateToken, authorizeAdmin } = require('../middleware/auth');
const { validateIdNumber } = require('../utils/validators');
const technoline = require('../services/technoline');
const notifications = require('../services/notifications');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Recognized Hebrew/English column header variants, matched case-insensitively.
const NAME_HEADERS = ['שם', 'שם מלא', 'name', 'full name'];
const ID_HEADERS = ['תעודת זהות', 'ת.ז', 'ת״ז', 'תז', 'id', 'idnumber', 'id number'];
const PHONE_HEADERS = ['טלפון', 'נייד', 'phone', 'mobile'];

function findColumn(headerRow, candidates) {
  for (let col = 1; col <= headerRow.cellCount; col++) {
    const value = String(headerRow.getCell(col).value || '').trim().toLowerCase();
    if (candidates.some(c => c.toLowerCase() === value)) return col;
  }
  return null;
}

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

// Bulk import users from an Excel file (admin only)
// Expects columns named (any case, Hebrew or English): שם/name, תעודת זהות/id, טלפון/phone (optional)
router.post('/users/import', authenticateToken, authorizeAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    const sheet = workbook.worksheets[0];

    if (!sheet || sheet.rowCount < 2) {
      return res.status(400).json({ error: 'Sheet is empty or missing a header row' });
    }

    const headerRow = sheet.getRow(1);
    const nameCol = findColumn(headerRow, NAME_HEADERS);
    const idCol = findColumn(headerRow, ID_HEADERS);
    const phoneCol = findColumn(headerRow, PHONE_HEADERS);

    if (!nameCol || !idCol) {
      return res.status(400).json({
        error: 'Could not find required columns',
        message: 'העמודה חייבת לכלול כותרות "שם" ו"תעודת זהות" (או name/id)',
      });
    }

    const results = { added: 0, updated: 0, skipped: [] };

    for (let rowNum = 2; rowNum <= sheet.rowCount; rowNum++) {
      const row = sheet.getRow(rowNum);
      const name = String(row.getCell(nameCol).value || '').trim();
      const idNumber = String(row.getCell(idCol).value || '').trim().replace(/\D/g, '');
      const phone = phoneCol ? String(row.getCell(phoneCol).value || '').trim() : undefined;

      if (!name && !idNumber) continue; // blank row

      if (!name || !idNumber) {
        results.skipped.push({ row: rowNum, reason: 'חסר שם או תעודת זהות' });
        continue;
      }

      if (!validateIdNumber(idNumber)) {
        results.skipped.push({ row: rowNum, name, reason: 'תעודת זהות לא תקינה' });
        continue;
      }

      const [user, created] = await User.findOrCreate({
        where: { idNumber },
        defaults: { name, phone: phone || null },
      });

      if (created) {
        results.added += 1;
      } else {
        await user.update({ name, ...(phone ? { phone } : {}) });
        results.updated += 1;
      }
    }

    res.json({ success: true, ...results });
  } catch (error) {
    console.error('Import users error:', error);
    res.status(500).json({ error: 'Failed to import users', message: error.message });
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

// ---- Recordings management ----

// List all recordings on the shared audio extension (admin only)
router.get('/recordings', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const extensionId = process.env.TECHNOLINE_AUDIO_EXTENSION;
    if (!extensionId) {
      return res.status(400).json({ error: 'TECHNOLINE_AUDIO_EXTENSION not configured' });
    }
    const files = await technoline.filesList(extensionId);
    res.json(Array.isArray(files) ? files : []);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch recordings', message: error.message });
  }
});

// Upload a new recording (admin only)
router.post('/recordings/upload', authenticateToken, authorizeAdmin, upload.single('file'), async (req, res) => {
  try {
    const extensionId = process.env.TECHNOLINE_AUDIO_EXTENSION;
    if (!extensionId) {
      return res.status(400).json({ error: 'TECHNOLINE_AUDIO_EXTENSION not configured' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const result = await technoline.uploadFile(extensionId, req.file.buffer, req.file.originalname, {
      name: req.body.name || undefined,
      checkDuplicate: 'BACKUP',
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to upload recording', message: error.message });
  }
});

// Delete a recording (admin only)
router.delete('/recordings/:fileId', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const extensionId = process.env.TECHNOLINE_AUDIO_EXTENSION;
    await technoline.fileDelete(req.params.fileId, extensionId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete recording', message: error.message });
  }
});

// ---- Broadcast messages ----

// Send a voice broadcast message to all active users (admin only)
router.post('/broadcast', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message text required' });
    }

    const users = await User.findAll({ where: { isActive: true } });
    const results = await notifications.sendBroadcastMessage(users, message.trim());
    res.json({ success: true, sentTo: Object.keys(results).length, results });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send broadcast', message: error.message });
  }
});

module.exports = router;

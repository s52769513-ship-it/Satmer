const express = require('express');
const router = express.Router();
const { User, Activity, Completion, ActivityLog } = require('../models');
const { getWeekStartDate, getWeekNumber, canUpdateActivityThisWeek, canUpdateCompletionThisMonth } = require('../utils/validators');

/**
 * Technoline "API model" callback (messagesType=apiUrl).
 * Called once the recipient answers, then again on every `gather` submitTo.
 * We drive the whole call flow from here based on `event` + `digits`.
 *
 * Request body (from Technoline): { campaignId, campaignCallId, phone, callId, callLength, event, digits? }
 */
router.post('/call', async (req, res) => {
  try {
    const { phone, event, digits } = req.body;

    if (!phone) {
      return res.json({ actions: [{ say: 'שגיאה במערכת. נסי שוב מאוחר יותר.' }, { hangup: true }] });
    }

    const user = await User.findOne({ where: { phone: normalizePhone(phone) } });

    if (!user) {
      return res.json({
        actions: [
          { say: 'מספר טלפון זה אינו רשום במערכת. אנא פני למנהלת המערכת.' },
          { hangup: true },
        ],
      });
    }

    if (event === 'answered' || !digits) {
      return res.json(buildMainMenu());
    }

    if (event === 'dtmf') {
      return res.json(await handleMenuChoice(user, digits, req.body.submitTo));
    }

    // hangup or unknown event - nothing to do
    return res.json({ actions: [] });
  } catch (error) {
    console.error('Webhook /call error:', error);
    res.json({ actions: [{ say: 'אירעה שגיאה. אנא נסי שוב מאוחר יותר.' }, { hangup: true }] });
  }
});

function buildMainMenu() {
  return {
    actions: [
      { say: 'ברוכים הבאים למערכת עדכון פעילות חסד. לעדכון פעילות שבועית הקישי 1. לעדכון השלמה הקישי 2. לשמיעת הזכויות שלך הקישי 3.' },
      { gather: { maxDigits: 1, timeout: 8, submitTo: `${process.env.APP_URL}/api/ivr-webhook/call` } },
    ],
  };
}

async function handleMenuChoice(user, digit, submitTo) {
  if (digit === '1') return extension1Flow(user);
  if (digit === '2') return extension2Flow(user);
  if (digit === '3') return extension3Flow(user);

  return {
    actions: [
      { say: 'בחירה לא תקינה.' },
      ...buildMainMenu().actions,
    ],
  };
}

async function extension1Flow(user) {
  const weekStart = getWeekStartDate();
  const weekNumber = getWeekNumber();

  if (user.lastActivityUpdate && !canUpdateActivityThisWeek(user.lastActivityUpdate)) {
    return { actions: [{ say: `כבר עדכנת את פעילות השבוע. ניתן לעדכן שוב במוצאי שבת.` }, { hangup: true }] };
  }

  const activity = await Activity.create({
    userId: user.id,
    weekStartDate: weekStart,
    weekNumber,
    participated: true,
    points: 10,
  });

  await user.update({ lastActivityUpdate: new Date() });

  await ActivityLog.create({
    userId: user.id,
    action: 'extension_1_activity_update',
    extension: 1,
    status: 'success',
    details: { weekNumber, points: activity.points },
  });

  return {
    actions: [
      { say: `עידכנת על השתתפותך בפעילות החסד לשבוע ${weekNumber}. תודה רבה ויישר כח!` },
      { hangup: true },
    ],
  };
}

async function extension2Flow(user) {
  const today = new Date();

  const lastCompletion = await Completion.findOne({
    where: { userId: user.id },
    order: [['createdAt', 'DESC']],
  });

  if (lastCompletion && !canUpdateCompletionThisMonth(lastCompletion.createdAt)) {
    return { actions: [{ say: 'כבר עדכנת השלמה בחודש זה. ניתן לעדכן שוב בתחילת החודש הבא.' }, { hangup: true }] };
  }

  const completionCount = await Completion.count({ where: { userId: user.id } });
  const nextNumber = completionCount + 1;

  await Completion.create({
    userId: user.id,
    completionNumber: nextNumber,
    month: today.getMonth() + 1,
    year: today.getFullYear(),
    points: 20,
    completedAt: today,
  });

  await ActivityLog.create({
    userId: user.id,
    action: 'extension_2_completion_update',
    extension: 2,
    status: 'success',
    details: { completionNumber: nextNumber },
  });

  return {
    actions: [
      { say: `עידכנת על השלמה מספר ${nextNumber} בשנה זו. כל הכבוד!` },
      { hangup: true },
    ],
  };
}

async function extension3Flow(user) {
  const activities = await Activity.findAll({ where: { userId: user.id } });
  const completions = await Completion.findAll({ where: { userId: user.id } });

  const activityPoints = activities.reduce((sum, a) => sum + (a.points || 0), 0);
  const completionPoints = completions.reduce((sum, c) => sum + (c.points || 0), 0);
  const totalPoints = activityPoints + completionPoints;
  const participationCount = activities.filter(a => a.participated).length;

  return {
    actions: [
      {
        say: `סיכום הזכויות שלך: השתתפת בפעילות החסד ${participationCount} פעמים, השלמת ${completions.length} השלמות, ובסך הכל צברת ${totalPoints} נקודות. תודה על ההשתתפות!`,
      },
      { hangup: true },
    ],
  };
}

function normalizePhone(phone) {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('972')) return '0' + digits.slice(3);
  if (digits.startsWith('0')) return digits;
  return '0' + digits;
}

module.exports = router;

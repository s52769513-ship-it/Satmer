const express = require('express');
const router = express.Router();
const { User, Activity, Completion, ActivityLog } = require('../models');
const { validateIdNumber, getWeekStartDate, getWeekNumber, canUpdateActivityThisWeek, canUpdateCompletionThisMonth } = require('../utils/validators');

/**
 * Technoline PBX Extension "API" module — inbound call handler.
 *
 * Their switchboard calls this endpoint (GET) the moment a caller reaches
 * the extension wired to this URL, and again after every module that reads
 * an answer (getDTMF / simpleMenu) — re-sending every value collected so
 * far as query params, keyed by the `name` we gave each module. That makes
 * this handler stateless: the whole call flow is decided fresh, every
 * request, from which params have shown up.
 *
 * Unlike a phone-based system that trusts Caller ID, this line requires the
 * caller to key in their Israeli ID number (מ.ז) before anything else —
 * that is the authentication, not the calling number.
 */

const ID_PARAM = 'idNumber';
const MENU_PARAM = 'menuChoice';

async function handlePbxRequest(req, res) {
  try {
    const params = { ...req.query, ...req.body };
    const token = process.env.TECHNOLINE_PBX_TOKEN;
    if (token && params.token !== token) {
      return res.json(simpleMessage('שגיאת הזדהות. אנא פני למנהלת המערכת.'));
    }

    const idNumberDigits = params[ID_PARAM];
    const menuChoice = params[MENU_PARAM];

    // Step 1: not yet identified — ask for the ID number.
    if (!idNumberDigits) {
      return res.json(askForIdNumber());
    }

    // Step 2: ID number was just entered — validate and look up the user.
    const user = await User.findOne({ where: { idNumber: idNumberDigits } });

    if (!validateIdNumber(idNumberDigits) || !user || !user.isActive) {
      return res.json(simpleMessage('מספר זהות לא נמצא במערכת. אנא פני למנהלת המערכת.', { hangup: true }));
    }

    // Step 3: identified but no extension chosen yet — main menu.
    if (!menuChoice) {
      return res.json(mainMenu());
    }

    // Step 4: extension chosen — run it.
    if (menuChoice === '1') return res.json(await extension1(user));
    if (menuChoice === '2') return res.json(await extension2(user));
    if (menuChoice === '3') return res.json(await extension3(user));

    return res.json(simpleMessage('בחירה לא תקינה.', { then: mainMenu() }));
  } catch (error) {
    console.error('PBX /technoline error:', error);
    res.json(simpleMessage('אירעה שגיאה במערכת. אנא נסי שוב מאוחר יותר.', { hangup: true }));
  }
}

router.get('/technoline', handlePbxRequest);
// Their PBX may prefer POST; same handling either way.
router.post('/technoline', handlePbxRequest);

// ---- module builders ----

function askForIdNumber() {
  return {
    type: 'getDTMF',
    name: ID_PARAM,
    max: 9,
    min: 9,
    timeout: 12,
    skipKey: '#',
    confirmType: 'no',
    files: [{ text: 'ברוכים הבאים למערכת עדכון פעילות חסד. אנא הקישי את מספר תעודת הזהות שלך, ולאחר מכן הקישי סולמית.' }],
  };
}

function mainMenu() {
  return {
    type: 'simpleMenu',
    name: MENU_PARAM,
    enabledKeys: '1,2,3',
    times: 3,
    timeout: 8,
    files: [
      {
        text: 'לעדכון פעילות חסד שבועית הקישי 1. לעדכון השלמה הקישי 2. לשמיעת סיכום הזכויות שלך הקישי 3.',
      },
    ],
  };
}

function simpleMessage(text, { hangup = false, then = null } = {}) {
  const modules = [{ type: 'simpleMessage', files: [{ text }] }];
  if (hangup) modules.push({ type: 'hangup' });
  if (then) return modules.concat(Array.isArray(then) ? then : [then]);
  return modules.length === 1 ? modules[0] : modules;
}

// ---- extension logic ----

async function extension1(user) {
  const weekStart = getWeekStartDate();
  const weekNumber = getWeekNumber();

  if (user.lastActivityUpdate && !canUpdateActivityThisWeek(user.lastActivityUpdate)) {
    return simpleMessage(`כבר עדכנת את פעילות השבוע. ניתן לעדכן שוב במוצאי שבת.`, { hangup: true });
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

  return simpleMessage(`עידכנת על השתתפותך בפעילות החסד לשבוע ${weekNumber}. תודה רבה ויישר כח!`, { hangup: true });
}

async function extension2(user) {
  const today = new Date();

  const lastCompletion = await Completion.findOne({
    where: { userId: user.id },
    order: [['createdAt', 'DESC']],
  });

  if (lastCompletion && !canUpdateCompletionThisMonth(lastCompletion.createdAt)) {
    return simpleMessage('כבר עדכנת השלמה בחודש זה. ניתן לעדכן שוב בתחילת החודש הבא.', { hangup: true });
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

  return simpleMessage(`עידכנת על השלמה מספר ${nextNumber} בשנה זו. כל הכבוד!`, { hangup: true });
}

async function extension3(user) {
  const activities = await Activity.findAll({ where: { userId: user.id } });
  const completions = await Completion.findAll({ where: { userId: user.id } });

  const activityPoints = activities.reduce((sum, a) => sum + (a.points || 0), 0);
  const completionPoints = completions.reduce((sum, c) => sum + (c.points || 0), 0);
  const totalPoints = activityPoints + completionPoints;
  const participationCount = activities.filter(a => a.participated).length;

  return simpleMessage(
    `סיכום הזכויות שלך: השתתפת בפעילות החסד ${participationCount} פעמים, השלמת ${completions.length} השלמות, ובסך הכל צברת ${totalPoints} נקודות. תודה על ההשתתפות!`,
    { hangup: true }
  );
}

module.exports = router;

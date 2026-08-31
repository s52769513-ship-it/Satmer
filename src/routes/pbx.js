const express = require('express');
const router = express.Router();
const { User, Activity, Completion, ActivityLog } = require('../models');
const { validateIdNumber, getWeekStartDate, getWeekNumber, canUpdateActivityThisWeek, canUpdateCompletionThisMonth } = require('../utils/validators');
const { speechCatalog } = require('../services/speech');
const { PHRASES } = require('../utils/phrases');
const { getParashaName } = require('../utils/hebrew-date');

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
 *
 * Speech: Technoline's own `text` TTS does not reliably synthesize new
 * text on this line (confirmed empirically). Every fixed prompt is
 * pre-synthesized and uploaded to a dedicated audio extension (see
 * services/speech.js) and referenced here by `fileName`; only truly
 * dynamic values (week numbers, point totals) go through the `number`
 * item type, which Technoline speaks natively without synthesis.
 */

const ID_PARAM = 'idNumber';
const MENU_PARAM = 'menuChoice';
const CONFIRM1_PARAM = 'confirm1';
const CONFIRM2_PARAM = 'confirm2';
const SUBMENU3_PARAM = 'subMenu3';
const REMINDER_DAY_PARAM = 'reminderDay';
const REMINDER_HOUR_PARAM = 'reminderHour';

const REMINDER_DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/** A pre-uploaded clip, referenced by name. Prefers an admin's own
 * recording (uploaded via the site's Recordings page) over the
 * TTS-synthesized version, when one exists for this phrase. Falls back to
 * raw text (silent today, but harmless) if neither is ready yet. */
function clip(phraseKey) {
  if (speechCatalog.hasOverride(phraseKey)) {
    return { fileName: speechCatalog.overrideName(phraseKey), extensionId: speechCatalog.extensionId };
  }
  return clipText(PHRASES[phraseKey]);
}

/** Same as `clip`, but for text that isn't in the fixed PHRASES catalog —
 * e.g. this week's parasha name, which changes weekly. Fires off a
 * background synthesis request when not yet ready, so it's likely to be
 * ready by the next call even though this one falls back to silent text. */
function clipText(text) {
  // Without extensionId, Technoline looks for the file in the extension
  // currently running (the API extension itself), not the dedicated audio
  // extension we actually uploaded it to.
  if (speechCatalog.isReady(text)) {
    return { fileName: speechCatalog.fileNameFor(text), extensionId: speechCatalog.extensionId };
  }
  speechCatalog.ensure(text).catch(() => {});
  return { text };
}

function numberItem(value) {
  return { number: String(value) };
}

async function handlePbxRequest(req, res) {
  try {
    const params = { ...req.query, ...req.body };
    // Per Technoline's Module API docs: the final HANGUP notification must
    // get an empty 200, never a module — the caller is already gone, and
    // returning one "may produce errors on the PBX side". Short-circuit
    // before any auth/lookup logic runs.
    if (params.PBXcallStatus === 'HANGUP') {
      return res.status(200).end();
    }

    const token = process.env.TECHNOLINE_PBX_TOKEN;
    if (token && params.token !== token) {
      return res.json(simpleMessage('authError'));
    }

    const idNumberDigits = params[ID_PARAM];

    // Step 1: not yet identified — ask for the ID number.
    if (!idNumberDigits) {
      return res.json(askForIdNumber());
    }

    // Step 2: ID number was just entered — validate and look up the user.
    const user = await User.findOne({ where: { idNumber: idNumberDigits } });

    if (!validateIdNumber(idNumberDigits) || !user || !user.isActive) {
      return res.json(simpleMessage('idNotFound', { hangup: true }));
    }

    const menuChoice = params[MENU_PARAM]?.trim();

    // Step 3: identified but no extension chosen yet — main menu.
    if (!menuChoice) {
      return res.json(mainMenu());
    }

    if (menuChoice === '1') return res.json(await handleExtension1(user, params));
    if (menuChoice === '2') return res.json(await handleExtension2(user, params));
    if (menuChoice === '3') return res.json(await handleExtension3(user, params));
    if (menuChoice === '4') return res.json(await handleExtension4(user, params));

    return res.json([simpleMessageModule('invalidChoice'), mainMenu()]);
  } catch (error) {
    console.error('PBX /technoline error:', error);
    res.json(simpleMessage('systemError', { hangup: true }));
  }
}

router.get('/technoline', handlePbxRequest);
// Their PBX may prefer POST; same handling either way.
router.post('/technoline', handlePbxRequest);

/**
 * Debugging aid only: a fixed announcement + hangup, no getDTMF, no DB
 * lookups. Point a Technoline extension at this temporarily to isolate
 * whether audio playback works at all, independent of our call flow logic.
 */
function testAnnouncement() {
  return [
    { type: 'simpleMessage', files: [clipText('בדיקה, אחת שתיים שלוש. אם אתם שומעים הודעה זו, המערכת פעילה.')] },
    { type: 'hangup' },
  ];
}
function handleTestRequest(req, res) {
  const params = { ...req.query, ...req.body };
  if (params.PBXcallStatus === 'HANGUP') return res.status(200).end();
  res.json(testAnnouncement());
}
router.get('/technoline-test', handleTestRequest);
router.post('/technoline-test', handleTestRequest);

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
    files: [clip('welcomeAskId')],
  };
}

function mainMenu() {
  return {
    type: 'simpleMenu',
    name: MENU_PARAM,
    enabledKeys: '1,2,3,4',
    times: 3,
    timeout: 8,
    files: [clip('mainMenu')],
  };
}

function simpleMessageModule(phraseKey) {
  return { type: 'simpleMessage', files: [clip(phraseKey)] };
}

function simpleMessage(phraseKey, { hangup = false } = {}) {
  const modules = [simpleMessageModule(phraseKey)];
  if (hangup) modules.push({ type: 'hangup' });
  return modules.length === 1 ? modules[0] : modules;
}

/** A "press # to confirm, 9 to go back" gate before an irreversible write. */
function confirmGate(name) {
  return {
    type: 'simpleMenu',
    name,
    enabledKeys: '#,9',
    times: 2,
    timeout: 10,
    extensionChange: '.',
  };
}

// ---- Extension 1: weekly activity update ----

async function handleExtension1(user, params) {
  const parasha = await getParashaName();
  const confirm1 = params[CONFIRM1_PARAM];

  if (!confirm1) {
    return [
      { ...confirmGate(CONFIRM1_PARAM), files: [clip('confirmActivityPrefix'), clipText(parasha), clip('confirmActivitySuffix')] },
    ];
  }

  if (confirm1 !== '#') {
    return [simpleMessageModule('cancelled'), mainMenu()];
  }

  return recordActivity(user, parasha);
}

async function recordActivity(user, parasha) {
  const weekStart = getWeekStartDate();
  const weekNumber = getWeekNumber();
  parasha = parasha || await getParashaName();

  if (user.lastActivityUpdate && !canUpdateActivityThisWeek(user.lastActivityUpdate)) {
    return simpleMessage('alreadyUpdatedThisWeek', { hangup: true });
  }

  const activity = await Activity.create({
    userId: user.id,
    weekStartDate: weekStart,
    weekNumber,
    parashaName: parasha,
    participated: true,
    points: 10,
  });

  await user.update({ lastActivityUpdate: new Date() });

  await ActivityLog.create({
    userId: user.id,
    action: 'extension_1_activity_update',
    extension: 1,
    status: 'success',
    details: { weekNumber, parasha, points: activity.points },
  });

  return [
    {
      type: 'simpleMessage',
      files: [clip('activityUpdatedPrefix'), clipText(parasha), clip('activityUpdatedSuffix')],
    },
    { type: 'hangup' },
  ];
}

// ---- Extension 2: monthly completion update ----

async function handleExtension2(user, params) {
  const completionCount = await Completion.count({ where: { userId: user.id } });
  const nextNumber = completionCount + 1;
  const confirm2 = params[CONFIRM2_PARAM];

  if (!confirm2) {
    return [
      { ...confirmGate(CONFIRM2_PARAM), files: [clip('confirmCompletionPrefix'), numberItem(nextNumber), clip('confirmCompletionSuffix')] },
    ];
  }

  if (confirm2 !== '#') {
    return [simpleMessageModule('cancelled'), mainMenu()];
  }

  return recordCompletion(user);
}

async function recordCompletion(user) {
  const today = new Date();

  const lastCompletion = await Completion.findOne({
    where: { userId: user.id },
    order: [['createdAt', 'DESC']],
  });

  if (lastCompletion && !canUpdateCompletionThisMonth(lastCompletion.createdAt)) {
    return simpleMessage('alreadyUpdatedThisMonth', { hangup: true });
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

  return [
    {
      type: 'simpleMessage',
      files: [clip('completionUpdatedPrefix'), numberItem(nextNumber), clip('completionUpdatedSuffix')],
    },
    { type: 'hangup' },
  ];
}

// ---- Extension 3: summary, as three separate sub-options per the spec ----

async function handleExtension3(user, params) {
  const subMenu3 = params[SUBMENU3_PARAM];

  if (!subMenu3) {
    return {
      type: 'simpleMenu',
      name: SUBMENU3_PARAM,
      enabledKeys: '1,2,3',
      times: 3,
      timeout: 8,
      extensionChange: '.',
      files: [clip('summaryMenu')],
    };
  }

  const activities = await Activity.findAll({ where: { userId: user.id } });
  const completions = await Completion.findAll({ where: { userId: user.id } });
  const activityPoints = activities.reduce((sum, a) => sum + (a.points || 0), 0);
  const completionPoints = completions.reduce((sum, c) => sum + (c.points || 0), 0);

  if (subMenu3 === '1') {
    return [
      { type: 'simpleMessage', files: [clip('summaryActivityPrefix'), numberItem(activityPoints), clip('summaryActivitySuffix')] },
      { type: 'hangup' },
    ];
  }
  if (subMenu3 === '2') {
    return [
      { type: 'simpleMessage', files: [clip('summaryCompletionsPrefix'), numberItem(completionPoints), clip('summaryCompletionsSuffixOnly')] },
      { type: 'hangup' },
    ];
  }
  if (subMenu3 === '3') {
    return [
      { type: 'simpleMessage', files: [clip('summaryTotalPrefix'), numberItem(activityPoints + completionPoints), clip('summaryTotalSuffix')] },
      { type: 'hangup' },
    ];
  }

  return [simpleMessageModule('invalidChoice'), mainMenu()];
}

// ---- Extension 4: choose weekly reminder day/hour ----

async function handleExtension4(user, params) {
  const day = params[REMINDER_DAY_PARAM];
  const hour = params[REMINDER_HOUR_PARAM];

  if (!day) {
    return {
      type: 'simpleMenu',
      name: REMINDER_DAY_PARAM,
      enabledKeys: '1,2,3,4,5,6,7',
      times: 3,
      timeout: 8,
      extensionChange: '.',
      files: [clip('askReminderDay')],
    };
  }

  if (!hour) {
    return {
      type: 'getDTMF',
      name: REMINDER_HOUR_PARAM,
      max: 2,
      min: 1,
      timeout: 8,
      skipKey: '#',
      confirmType: 'no',
      files: [clip('askReminderHour')],
    };
  }

  const hourNum = Number(hour);
  if (!Number.isInteger(hourNum) || hourNum < 0 || hourNum > 23) {
    return [simpleMessageModule('invalidChoice'), mainMenu()];
  }

  const dayName = REMINDER_DAYS[Number(day) - 1];
  await user.update({ notificationDay: dayName, notificationHour: hourNum });

  return [
    { type: 'simpleMessage', files: [clip('reminderSavedPrefix'), numberItem(hourNum), clip('reminderSavedSuffix')] },
    { type: 'hangup' },
  ];
}

module.exports = router;

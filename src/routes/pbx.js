const express = require('express');
const router = express.Router();
const { User, Activity, Completion, ActivityLog } = require('../models');
const { validateIdNumber, getWeekStartDate, getWeekNumber, canUpdateActivityThisWeek, canUpdateCompletionThisMonth } = require('../utils/validators');
const { speechCatalog } = require('../services/speech');
const { PHRASES } = require('../utils/phrases');

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

/** A pre-uploaded clip, referenced by name. Falls back to raw text (silent
 * today, but harmless) if the clip hasn't finished uploading yet. */
function clip(phraseKey) {
  const text = PHRASES[phraseKey];
  // Without extensionId, Technoline looks for the file in the extension
  // currently running (the API extension itself), not the dedicated audio
  // extension we actually uploaded it to.
  return speechCatalog.isReady(text)
    ? { fileName: speechCatalog.fileNameFor(text), extensionId: speechCatalog.extensionId }
    : { text };
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
    const menuChoice = params[MENU_PARAM];

    // Step 1: not yet identified — ask for the ID number.
    if (!idNumberDigits) {
      return res.json(askForIdNumber());
    }

    // Step 2: ID number was just entered — validate and look up the user.
    const user = await User.findOne({ where: { idNumber: idNumberDigits } });

    if (!validateIdNumber(idNumberDigits) || !user || !user.isActive) {
      return res.json(simpleMessage('idNotFound', { hangup: true }));
    }

    // Step 3: identified but no extension chosen yet — main menu.
    if (!menuChoice) {
      return res.json(mainMenu());
    }

    // Step 4: extension chosen — run it.
    if (menuChoice === '1') return res.json(await extension1(user));
    if (menuChoice === '2') return res.json(await extension2(user));
    if (menuChoice === '3') return res.json(await extension3(user));

    return res.json({
      actions: [simpleMessage('invalidChoice'), mainMenu()],
    }.actions);
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
  const text = 'בדיקה, אחת שתיים שלוש. אם אתם שומעים הודעה זו, המערכת פעילה.';
  const files = speechCatalog.isReady(text)
    ? [{ fileName: speechCatalog.fileNameFor(text), extensionId: speechCatalog.extensionId }]
    : [{ text }];
  return [
    { type: 'simpleMessage', files },
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
    enabledKeys: '1,2,3',
    times: 3,
    timeout: 8,
    files: [clip('mainMenu')],
  };
}

function simpleMessage(phraseKey, { hangup = false } = {}) {
  const modules = [{ type: 'simpleMessage', files: [clip(phraseKey)] }];
  if (hangup) modules.push({ type: 'hangup' });
  return modules.length === 1 ? modules[0] : modules;
}

// ---- extension logic ----

async function extension1(user) {
  const weekStart = getWeekStartDate();
  const weekNumber = getWeekNumber();

  if (user.lastActivityUpdate && !canUpdateActivityThisWeek(user.lastActivityUpdate)) {
    return simpleMessage('alreadyUpdatedThisWeek', { hangup: true });
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

  return [
    {
      type: 'simpleMessage',
      files: [clip('activityUpdatedPrefix'), numberItem(weekNumber), clip('activityUpdatedSuffix')],
    },
    { type: 'hangup' },
  ];
}

async function extension2(user) {
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

async function extension3(user) {
  const activities = await Activity.findAll({ where: { userId: user.id } });
  const completions = await Completion.findAll({ where: { userId: user.id } });

  const activityPoints = activities.reduce((sum, a) => sum + (a.points || 0), 0);
  const completionPoints = completions.reduce((sum, c) => sum + (c.points || 0), 0);
  const totalPoints = activityPoints + completionPoints;
  const participationCount = activities.filter(a => a.participated).length;

  return [
    {
      type: 'simpleMessage',
      files: [
        clip('summaryParticipatedPrefix'),
        numberItem(participationCount),
        clip('summaryParticipatedSuffix'),
        numberItem(completions.length),
        clip('summaryCompletionsSuffix'),
        numberItem(totalPoints),
        clip('summaryPointsSuffix'),
      ],
    },
    { type: 'hangup' },
  ];
}

module.exports = router;

/**
 * One-time, idempotent fix for activity/completion rows written before
 * points were unified to 1 per update (activity used to award 10, completion
 * 20). Targets the exact old constants rather than "anything not 1", so it
 * can never touch a legitimate `points: 0` "didn't participate" row (the
 * legacy src/routes/ivr.js path could have created those). Safe to run on
 * every boot - once no row matches, both updates are no-ops forever.
 */
async function fixLegacyPoints(sequelize) {
  const { Activity, Completion } = sequelize.models;
  const [activitiesFixed] = await Activity.update({ points: 1 }, { where: { points: 10 } });
  const [completionsFixed] = await Completion.update({ points: 1 }, { where: { points: 20 } });
  if (activitiesFixed || completionsFixed) {
    console.log(`✅ Fixed legacy points: ${activitiesFixed} activities, ${completionsFixed} completions`);
  }
}

module.exports = fixLegacyPoints;

// Hebrew calendar helpers: parsha name, Hebrew date, Hebrew weekday names.
//
// @hebcal/core is ESM-only, so it's loaded via dynamic import() from this
// CommonJS codebase (works fine in Node — only `require()` is restricted
// to CJS, not `import()`).

const HEBREW_DAY_NAMES = {
  sunday: 'יום ראשון',
  monday: 'יום שני',
  tuesday: 'יום שלישי',
  wednesday: 'יום רביעי',
  thursday: 'יום חמישי',
  friday: 'יום שישי',
  saturday: 'שבת קודש',
};

/**
 * Strips Hebrew vowel points/cantillation marks for plainer display/TTS,
 * via the Unicode "nonspacing mark" category rather than a fixed code
 * range — a fixed range around U+05B0–U+05C7 also catches the maqaf
 * (Hebrew hyphen, U+05BE), which is punctuation, not a diacritic, and
 * needs to survive (e.g. "נצבים־וילך").
 */
function stripNikud(text) {
  return text.normalize('NFC').replace(/\p{Mn}/gu, '');
}

/** "פרשת נצבים־וילך" for the Shabbat covering `date` (or the nearest one). */
async function getParashaName(date = new Date()) {
  const { HDate, Sedra, ParshaEvent } = await import('@hebcal/core');
  const hdate = new HDate(date);
  const sedra = new Sedra(hdate.getFullYear(), false);
  const result = sedra.lookup(hdate);
  if (!result.parsha) return null; // Yom Tov falls on Shabbat, no weekly parsha
  const event = new ParshaEvent(result);
  return stripNikud(event.render('he'));
}

/** "י״ח אלול תשפ״ו" for `date`. */
async function getHebrewDateString(date = new Date()) {
  const { HDate } = await import('@hebcal/core');
  return stripNikud(new HDate(date).renderGematriya());
}

function getHebrewDayName(dayKey) {
  return HEBREW_DAY_NAMES[dayKey] || dayKey;
}

module.exports = { getParashaName, getHebrewDateString, getHebrewDayName, stripNikud };

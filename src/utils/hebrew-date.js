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

/** Hebrew month name for `date`, e.g. "אלול" or "אדר א׳" / "אדר ב׳" in a leap year. */
async function getHebrewMonthName(date = new Date()) {
  const { HDate } = await import('@hebcal/core');
  const hdate = new HDate(date);
  // renderGematriya() gives the full "1 תשרי תשפ״ז" string; the month name
  // is everything between the day-of-month and the year, and already
  // disambiguates Adar I/II via the trailing ׳ character hebcal adds.
  const parts = stripNikud(hdate.renderGematriya()).split(' ');
  return parts.slice(1, -1).join(' ');
}

/** Hebrew year for `date`, e.g. 5786. */
async function getHebrewYear(date = new Date()) {
  const { HDate } = await import('@hebcal/core');
  return new HDate(date).getFullYear();
}

/** Numeric Hebrew year (e.g. 5786) as customary letters, e.g. "תשפ״ו". */
async function hebrewYearLetters(year) {
  const { gematriya } = await import('@hebcal/core');
  return stripNikud(gematriya(year));
}

/** Every month name for `hebrewYear` in calendar order (Tishrei first), for a dropdown. */
async function listHebrewMonths(hebrewYear) {
  const { HDate } = await import('@hebcal/core');
  const count = HDate.monthsInYear(hebrewYear);
  // hebcal numbers months from Nisan (1) - reorder to the customary
  // Tishrei-first calendar-year order for display.
  const nisanOrder = Array.from({ length: count }, (_, i) => i + 1);
  const tishreiFirst = [...nisanOrder.slice(6), ...nisanOrder.slice(0, 6)];
  return tishreiFirst.map((m) => {
    const hdate = new HDate(1, m, hebrewYear);
    const parts = stripNikud(hdate.renderGematriya()).split(' ');
    return parts.slice(1, -1).join(' ');
  });
}

module.exports = {
  getParashaName,
  getHebrewDateString,
  getHebrewDayName,
  getHebrewMonthName,
  getHebrewYear,
  hebrewYearLetters,
  listHebrewMonths,
  stripNikud,
};

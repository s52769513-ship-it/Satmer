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

/**
 * The organization's tracking year for `date`: a cycle that starts on Rosh
 * Chodesh Sivan rather than the religious calendar's own Tishrei 1, so it
 * doesn't line up with `HDate.getFullYear()`. A cycle beginning 1 Sivan of
 * calendar year Y runs Sivan(Y)..Elul(Y), then Tishrei(Y+1)..Iyar(Y+1) - the
 * majority of it (8 of 12 months) falls in calendar year Y+1, so that's its
 * label, matching how a Sivan-to-Sivan "school year" is customarily named.
 */
async function getHebrewYear(date = new Date()) {
  const { HDate } = await import('@hebcal/core');
  const hdate = new HDate(date);
  const year = hdate.getFullYear();
  const sivanOne = new HDate(1, 3, year); // 1 Sivan of the same calendar year
  return hdate.abs() >= sivanOne.abs() ? year + 1 : year;
}

/** Numeric Hebrew year (e.g. 5786) as customary letters, e.g. "תשפ״ו". */
async function hebrewYearLetters(year) {
  const { gematriya } = await import('@hebcal/core');
  return stripNikud(gematriya(year));
}

/**
 * Every month name for tracking year `hebrewYear`, in the order they occur
 * within that Sivan-anchored cycle (see getHebrewYear): Sivan..Elul of
 * calendar year `hebrewYear - 1`, then Tishrei..Iyar of calendar year
 * `hebrewYear` itself - so, unlike a plain calendar year, this list can
 * straddle a leap year on either side of the Sivan boundary.
 */
async function listHebrewMonths(hebrewYear) {
  const { HDate } = await import('@hebcal/core');
  const monthName = (year, month) => {
    const hdate = new HDate(1, month, year);
    const parts = stripNikud(hdate.renderGematriya()).split(' ');
    return parts.slice(1, -1).join(' ');
  };

  const priorYear = hebrewYear - 1;
  const earlyPart = [3, 4, 5, 6].map((m) => monthName(priorYear, m)); // Sivan..Elul
  const countThisYear = HDate.monthsInYear(hebrewYear);
  const latterIndices = [...Array(countThisYear - 6).keys()].map((i) => i + 7).concat([1, 2]); // Tishrei..(Adar/Adar II), then Nisan, Iyar
  const latterPart = latterIndices.map((m) => monthName(hebrewYear, m));

  return [...earlyPart, ...latterPart];
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

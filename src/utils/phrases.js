// Fixed catalog of Hebrew prompts spoken on the phone line.
//
// Technoline's own built-in TTS (the `text` field in a Module API response)
// does not actually synthesize anything for text it hasn't seen before —
// verified against the live line. What plays reliably is a pre-uploaded
// file. So every one of these is synthesized once (see services/speech.js),
// uploaded to a dedicated Technoline extension, and referenced by fileName
// instead of text at call time.
//
// Keep entries here static (no interpolation) so each one maps to exactly
// one cached audio file. Anything genuinely dynamic (a week number, a name)
// is spoken via the PBX's `number` / `digits` item types instead, which do
// work natively without pre-synthesis.

const PHRASES = {
  welcomeAskId: 'ברוכים הבאים ליצלח חסד ארגענעזאציע. אנא הקישי את מספר תעודת הזהות שלך, ולאחר מכן הקישי סולמית.',
  idNotFound: 'מספר זהות לא נמצא במערכת. אנא פני למנהלת המערכת.',
  mainMenu: 'לעדכון פעילות חסד שבועית הקישי 1. לעדכון השלמה הקישי 2. לשמיעת סיכום הזכויות שלך הקישי 3. להגדרת שעת תזכורת שבועית הקישי 4.',
  invalidChoice: 'בחירה לא תקינה.',
  alreadyUpdatedThisWeek: 'כבר עדכנת את פעילות השבוע. ניתן לעדכן שוב במוצאי שבת.',
  alreadyUpdatedThisMonth: 'כבר עדכנת השלמה בחודש זה. ניתן לעדכן שוב בתחילת החודש הבא.',
  systemError: 'אירעה שגיאה במערכת. אנא נסי שוב מאוחר יותר.',
  authError: 'שגיאת הזדהות. אנא פני למנהלת המערכת.',
  cancelled: 'הפעולה בוטלה.',

  // Fixed segments around dynamic numbers — the numbers themselves are
  // spoken natively by Technoline via `number` items, no synthesis needed.
  confirmActivityPrefix: 'עידכנתם על השתתפותכם בפעילות החסד בשבוע',
  confirmActivitySuffix: 'אם זה נכון הקישי סולמית לאישור, או 9 לחזרה לתפריט.',
  activityUpdatedPrefix: 'עידכנת על השתתפותך בפעילות החסד בשבוע',
  activityUpdatedSuffix: 'תודה רבה ויישר כח!',

  confirmCompletionPrefix: 'עידכנתם על השלמה מספר',
  confirmCompletionSuffix: 'בשנה זו. אם זה נכון הקישי סולמית לאישור, או 9 לחזרה לתפריט.',
  completionUpdatedPrefix: 'עידכנת על השלמה מספר',
  completionUpdatedSuffix: 'בשנה זו. כל הכבוד!',

  // Extension 3 sub-menu, per the spec's three separate options.
  summaryMenu: 'לשמיעת סכום הזכויות בפעילות החסד הקישי 1. לשמיעת סך ההשלמות שצברת הקישי 2. לשמיעת סך הכל השתתפות הקישי 3.',
  summaryActivityPrefix: 'צברת בפעילות החסד',
  summaryActivitySuffix: 'נקודות.',
  summaryCompletionsPrefix: 'צברת בהשלמות',
  summaryCompletionsSuffixOnly: 'נקודות.',
  summaryTotalPrefix: 'סך הכל צברת',
  summaryTotalSuffix: 'נקודות. תודה על ההשתתפות!',

  // Extension 4: weekly reminder day/time preference.
  askReminderDay: 'להגדרת יום התזכורת השבועית, הקישי ספרה אחת: 1 ליום ראשון, 2 לשני, 3 לשלישי, 4 לרביעי, 5 לחמישי, 6 לשישי, 7 לשבת.',
  askReminderHour: 'כעת הקישי את השעה הרצויה, במספר בין 0 ל-23, ולאחר מכן הקישי סולמית.',
  reminderSavedPrefix: 'התזכורת השבועית שלך נקבעה ליום שבחרת, בשעה',
  reminderSavedSuffix: '.',
};

module.exports = { PHRASES };

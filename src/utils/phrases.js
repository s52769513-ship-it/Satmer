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
  welcomeAskId: 'ברוכים הבאים למערכת עדכון פעילות חסד. אנא הקישי את מספר תעודת הזהות שלך, ולאחר מכן הקישי סולמית.',
  idNotFound: 'מספר זהות לא נמצא במערכת. אנא פני למנהלת המערכת.',
  mainMenu: 'לעדכון פעילות חסד שבועית הקישי 1. לעדכון השלמה הקישי 2. לשמיעת סיכום הזכויות שלך הקישי 3.',
  invalidChoice: 'בחירה לא תקינה.',
  alreadyUpdatedThisWeek: 'כבר עדכנת את פעילות השבוע. ניתן לעדכן שוב במוצאי שבת.',
  alreadyUpdatedThisMonth: 'כבר עדכנת השלמה בחודש זה. ניתן לעדכן שוב בתחילת החודש הבא.',
  systemError: 'אירעה שגיאה במערכת. אנא נסי שוב מאוחר יותר.',
  authError: 'שגיאת הזדהות. אנא פני למנהלת המערכת.',

  // Fixed segments around dynamic numbers — the numbers themselves are
  // spoken natively by Technoline via `number` items, no synthesis needed.
  activityUpdatedPrefix: 'עידכנת על השתתפותך בפעילות החסד לשבוע',
  activityUpdatedSuffix: 'תודה רבה ויישר כח!',
  completionUpdatedPrefix: 'עידכנת על השלמה מספר',
  completionUpdatedSuffix: 'בשנה זו. כל הכבוד!',
  summaryParticipatedPrefix: 'סיכום הזכויות שלך: השתתפת בפעילות החסד',
  summaryParticipatedSuffix: 'פעמים, השלמת',
  summaryCompletionsSuffix: 'השלמות, ובסך הכל צברת',
  summaryPointsSuffix: 'נקודות. תודה על ההשתתפות!',
};

module.exports = { PHRASES };

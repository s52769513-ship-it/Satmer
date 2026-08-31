// Validate Israeli ID number format
const validateIdNumber = (idNumber) => {
  const cleaned = idNumber.toString().replace(/[^\d]/g, '');

  if (cleaned.length !== 9) {
    return false;
  }

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let digit = parseInt(cleaned[i], 10);

    if ((i + 1) % 2 === 0) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
  }

  return sum % 10 === 0;
};

// Get current week number
const getWeekNumber = (date = new Date()) => {
  const onejan = new Date(date.getFullYear(), 0, 1);
  const millisecsInDay = 86400000;
  return Math.ceil(((date - onejan) / millisecsInDay + onejan.getDay() + 1) / 7);
};

// Get week start date (Saturday)
const getWeekStartDate = (date = new Date()) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);

  const weekStart = new Date(d.setDate(diff));
  return new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate());
};

// Check if user can update activity this week
const canUpdateActivityThisWeek = (lastUpdate) => {
  if (!lastUpdate) return true;

  const today = new Date();
  const weekStart = getWeekStartDate();

  return new Date(lastUpdate) < weekStart;
};

// Check if user can update completion this month
const canUpdateCompletionThisMonth = (lastUpdate) => {
  if (!lastUpdate) return true;

  const today = new Date();
  const currentMonth = today.getMonth();
  const lastMonth = new Date(lastUpdate).getMonth();

  return lastMonth !== currentMonth;
};

module.exports = {
  validateIdNumber,
  getWeekNumber,
  getWeekStartDate,
  canUpdateActivityThisWeek,
  canUpdateCompletionThisMonth,
};

const cron = require('node-cron');
const { User, Activity, Completion, UserNotification } = require('../models');
const { getWeekStartDate, getWeekNumber } = require('../utils/validators');

const setupSchedules = () => {
  // Weekly reset - Every Sunday at midnight
  // This resets weekly activities to allow new updates
  cron.schedule('0 0 * * 0', async () => {
    console.log('📅 Running weekly reset job');
    try {
      // Activities don't need reset, they're per-week
      console.log('✅ Weekly reset complete');
    } catch (error) {
      console.error('❌ Weekly reset failed:', error);
    }
  });

  // Monthly reset - 1st of each month at midnight
  // This resets completion monthly limit
  cron.schedule('0 0 1 * *', async () => {
    console.log('📅 Running monthly reset job');
    try {
      // Completions can be updated monthly, so no reset needed
      // Just log the occurrence
      console.log('✅ Monthly reset complete');
    } catch (error) {
      console.error('❌ Monthly reset failed:', error);
    }
  });

  // Yearly reset - 1st of Sivan (Hebrew) - typically May/June
  // We'll set it to run on June 1st as an approximation
  cron.schedule('0 0 1 6 *', async () => {
    console.log('📅 Running yearly reset job (1st of Sivan)');
    try {
      await Activity.truncate();
      await Completion.truncate();
      await User.update({ lastActivityUpdate: null }, { where: {} });
      console.log('✅ Yearly reset complete - all data cleared');
    } catch (error) {
      console.error('❌ Yearly reset failed:', error);
    }
  });

  // Weekly notification sender - Run every minute to check if notifications need to be sent
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      const dayName = getDayName(now.getDay());
      const hour = now.getHours();

      // Find users who should receive notification at this time
      const users = await User.findAll({
        where: {
          notificationDay: dayName,
          notificationHour: hour,
          isActive: true,
        },
      });

      if (users.length > 0) {
        console.log(`📞 Sending voice notifications to ${users.length} users at ${dayName} ${hour}:00`);
        const notificationService = require('./notifications');

        for (const user of users) {
          try {
            await notificationService.sendWeeklyReminder(user);
          } catch (error) {
            console.error(`Failed to send reminder to ${user.name}:`, error.message);
          }
        }
      }
    } catch (error) {
      console.error('❌ Notification sender error:', error);
    }
  });

  console.log('✅ All scheduled jobs initialized');
};


function getDayName(dayIndex) {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[dayIndex];
}

module.exports = setupSchedules;

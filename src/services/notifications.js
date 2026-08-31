const axios = require('axios');

class NotificationService {
  constructor() {
    this.apiKey = process.env.TECHNOLINE_API_KEY;
    this.apiUrl = process.env.TECHNOLINE_API_URL || 'https://api.ipsales.co.il/api';
  }

  // Send voice notification via Technoline phone system
  async sendVoiceNotification(phoneNumber, message, language = 'he') {
    try {
      console.log(`📞 Sending voice notification to ${phoneNumber}`);

      const response = await axios.post(
        `${this.apiUrl}/calls/voice-notification`,
        {
          to: phoneNumber,
          message,
          language,
          priority: 'high',
          retry: 3,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log(`✅ Voice notification sent to ${phoneNumber}`);
      return response.data;
    } catch (error) {
      console.error(`❌ Failed to send voice notification to ${phoneNumber}:`, error.message);
      throw error;
    }
  }

  // Send IVR message (through phone system)
  async sendIVRMessage(phoneNumber, extensionNumber, message) {
    try {
      console.log(`📞 Sending IVR message to ${phoneNumber} - Extension ${extensionNumber}`);

      const response = await axios.post(
        `${this.apiUrl}/ivr/send-message`,
        {
          phoneNumber,
          extensionNumber,
          message,
          language: 'he',
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log(`✅ IVR message sent to ${phoneNumber}`);
      return response.data;
    } catch (error) {
      console.error(`❌ Failed to send IVR message:`, error.message);
      throw error;
    }
  }

  // Send weekly reminder via voice call
  async sendWeeklyReminder(user) {
    try {
      if (!user.phone) {
        console.warn(`⚠️ User ${user.name} has no phone number`);
        return null;
      }

      const message = `שלום ${user.name}! זה זמן לעדכן את פעילות החסד שלך לשבוע זה. לחצי 1 בהרחבה 1 כדי לעדכן.`;

      return await this.sendVoiceNotification(user.phone, message, 'he');
    } catch (error) {
      console.error(`Failed to send reminder to ${user.name}:`, error.message);
      throw error;
    }
  }

  // Send achievement notification via voice
  async sendAchievementNotification(user, achievement) {
    try {
      if (!user.phone) {
        console.warn(`⚠️ User ${user.name} has no phone number`);
        return null;
      }

      const message = `כל הכבוד ${user.name}! ניצחנו ${achievement}. מזל טוב!`;

      return await this.sendVoiceNotification(user.phone, message, 'he');
    } catch (error) {
      console.error(`Failed to send achievement notification:`, error.message);
      throw error;
    }
  }

  // Send admin broadcast message to all users
  async sendBroadcastMessage(users, message) {
    const results = {};

    for (const user of users) {
      if (!user.phone || !user.isActive) {
        continue;
      }

      try {
        results[user.id] = await this.sendVoiceNotification(user.phone, message, 'he');
      } catch (error) {
        results[user.id] = { error: error.message };
      }
    }

    return results;
  }

  // Send weekly reminders to all users with scheduled notification time
  async sendWeeklyReminders(users) {
    console.log(`📞 Sending weekly reminders to ${users.length} users...`);
    const results = {};

    for (const user of users) {
      try {
        results[user.id] = await this.sendWeeklyReminder(user);
      } catch (error) {
        results[user.id] = { error: error.message };
      }
    }

    return results;
  }
}

module.exports = new NotificationService();

const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');

class NotificationService {
  constructor() {
    this.telegramBot = process.env.TELEGRAM_BOT_TOKEN
      ? new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false })
      : null;
  }

  // Send Telegram notification
  async sendTelegramNotification(userId, message, chatId) {
    try {
      if (!this.telegramBot || !chatId) {
        console.warn('Telegram bot not configured or chat ID missing');
        return null;
      }

      const response = await this.telegramBot.sendMessage(chatId, message, {
        parse_mode: 'HTML',
      });

      return response;
    } catch (error) {
      console.error('Failed to send Telegram notification:', error);
      throw error;
    }
  }

  // Send SMS via Technoline
  async sendSMS(phoneNumber, message) {
    try {
      const response = await axios.post(
        `${process.env.TECHNOLINE_API_URL}/messages/sms`,
        {
          to: phoneNumber,
          message,
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.TECHNOLINE_API_KEY}`,
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error('Failed to send SMS:', error);
      throw error;
    }
  }

  // Send voice call notification
  async sendVoiceCall(phoneNumber, message) {
    try {
      const response = await axios.post(
        `${process.env.TECHNOLINE_API_URL}/calls/voice-notification`,
        {
          to: phoneNumber,
          message,
          language: 'he',
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.TECHNOLINE_API_KEY}`,
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error('Failed to send voice call:', error);
      throw error;
    }
  }

  // Send email notification
  async sendEmail(email, subject, body) {
    try {
      const response = await axios.post(
        `${process.env.TECHNOLINE_API_URL}/email/send`,
        {
          to: email,
          subject,
          body,
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.TECHNOLINE_API_KEY}`,
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error('Failed to send email:', error);
      throw error;
    }
  }

  // Send notification via multiple channels
  async sendMultiChannel(user, message, channels = ['sms', 'telegram']) {
    const results = {};

    if (channels.includes('sms') && user.phone) {
      try {
        results.sms = await this.sendSMS(user.phone, message);
      } catch (error) {
        results.sms = { error: error.message };
      }
    }

    if (channels.includes('telegram') && user.telegramChatId) {
      try {
        results.telegram = await this.sendTelegramNotification(user.id, message, user.telegramChatId);
      } catch (error) {
        results.telegram = { error: error.message };
      }
    }

    if (channels.includes('email') && user.email) {
      try {
        results.email = await this.sendEmail(user.email, 'Chesed Activity Reminder', message);
      } catch (error) {
        results.email = { error: error.message };
      }
    }

    return results;
  }

  // Send weekly reminder to all users
  async sendWeeklyReminders(users) {
    const results = {};

    for (const user of users) {
      const message = `שלום ${user.name}! 👋\n\nזה זמן לעדכן את פעילות החסד שלך לשבוע זה.\n\nלחצי 1 בהרחבה 1 כדי לעדכן.`;

      try {
        results[user.id] = await this.sendMultiChannel(user, message, ['sms', 'telegram']);
      } catch (error) {
        results[user.id] = { error: error.message };
      }
    }

    return results;
  }
}

module.exports = new NotificationService();

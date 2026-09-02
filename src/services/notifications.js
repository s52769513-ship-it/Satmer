const axios = require('axios');

/**
 * Technoline Campaign API client — used exclusively to place outbound
 * voice calls (צינתוקים) to users. No SMS/email/other channel.
 * Docs: campaignApi.php
 */
class NotificationService {
  constructor() {
    this.apiKey = process.env.TECHNOLINE_API_KEY;
    this.baseUrl = process.env.TECHNOLINE_CAMPAIGN_API_URL || 'https://app.ipsales.co.il/campaignApi.php';
  }

  async _run(payload) {
    const response = await axios.post(this.baseUrl, {
      action: 'campaignRun',
      apiKey: this.apiKey,
      ...payload,
    }, {
      headers: { 'Content-Type': 'application/json' },
    });
    return response.data;
  }

  /**
   * Normalize to Israeli local format (leading 0), as required by campaignRun.
   */
  _normalizePhone(phone) {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('972')) return '0' + digits.slice(3);
    if (digits.startsWith('0')) return digits;
    return '0' + digits;
  }

  /**
   * Place a single outbound voice call reading `message` via TTS.
   */
  async sendVoiceNotification(phoneNumber, message, { title } = {}) {
    const phone = this._normalizePhone(phoneNumber);

    const result = await this._run({
      audioText: message,
      phones: [phone],
      title: title || 'Yatzliach Chesed Organization Notification',
      callLength: 25,
      dialRetries: 2,
      betweenRetries: 20,
      reasonableHours: 'yes',
    });

    if (result.errorCode && result.errorCode !== 0) {
      throw new Error(`Technoline campaignRun failed: errorCode=${result.errorCode} ${result.note || ''}`);
    }

    return result;
  }

  async sendWeeklyReminder(user) {
    if (!user.phone) {
      console.warn(`⚠️ User ${user.name} has no phone number`);
      return null;
    }

    const message = `שלום ${user.name}, זה זמן לעדכן את פעילות החסד שלך לשבוע זה. התקשרי למספר המערכת ולחצי 1 כדי לעדכן.`;

    return this.sendVoiceNotification(user.phone, message, { title: `תזכורת שבועית - ${user.name}` });
  }

  async sendAchievementNotification(user, achievement) {
    if (!user.phone) {
      console.warn(`⚠️ User ${user.name} has no phone number`);
      return null;
    }

    const message = `כל הכבוד ${user.name}! ${achievement}. מזל טוב!`;

    return this.sendVoiceNotification(user.phone, message, { title: `הישג - ${user.name}` });
  }

  /**
   * Broadcast the same message to every active user with a phone number,
   * in a single campaign call (one campaignRun for the whole batch).
   */
  async sendBroadcastMessage(users, message) {
    const phones = users
      .filter(u => u.isActive && u.phone)
      .map(u => this._normalizePhone(u.phone));

    if (phones.length === 0) {
      return { errorCode: 0, phones: 0, note: 'No eligible recipients' };
    }

    const result = await this._run({
      audioText: message,
      phones,
      title: 'Yatzliach Chesed Organization Admin Broadcast',
      callLength: 25,
      dialRetries: 2,
      betweenRetries: 20,
      reasonableHours: 'yes',
    });

    if (result.errorCode && result.errorCode !== 0) {
      throw new Error(`Technoline campaignRun failed: errorCode=${result.errorCode} ${result.note || ''}`);
    }

    return result;
  }

  /**
   * Send each user's individually-scheduled weekly reminder as one call each
   * (message content is per-user, so they cannot be batched into one campaign).
   */
  async sendWeeklyReminders(users) {
    console.log(`📞 Sending weekly voice reminders to ${users.length} users...`);
    const results = {};

    for (const user of users) {
      try {
        results[user.id] = await this.sendWeeklyReminder(user);
      } catch (error) {
        console.error(`Failed to send reminder to ${user.name}:`, error.message);
        results[user.id] = { error: error.message };
      }
    }

    return results;
  }
}

module.exports = new NotificationService();

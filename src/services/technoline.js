const axios = require('axios');

class TechnolineService {
  constructor() {
    this.apiKey = process.env.TECHNOLINE_API_KEY;
    this.apiUrl = process.env.TECHNOLINE_API_URL || 'https://api.ipsales.co.il/api';
    this.client = axios.create({
      baseURL: this.apiUrl,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  // Setup IVR extensions
  async setupExtensions() {
    try {
      // שלוחה 1: עדכון פעילות שבועי
      const ext1 = await this.setupExtension({
        extensionNumber: 1,
        name: 'עדכון פעילות חסד שבועי',
        greeting: 'ברוכים הבאים למערכת עדכון פעילות החסד. לחצי 1 כדי לעדכן את פעילותך השבועית.',
        actions: [
          { digit: '1', action: 'UPDATE_ACTIVITY', url: `${process.env.APP_URL}/api/ivr/extension-1/status` },
          { digit: '#', action: 'CONFIRM', url: `${process.env.APP_URL}/api/ivr/extension-1/confirm` },
        ],
      });

      // שלוחה 2: עדכון השלמות
      const ext2 = await this.setupExtension({
        extensionNumber: 2,
        name: 'עדכון השלמות',
        greeting: 'אתם בהרחבה לעדכון השלמות. לחצי 1 כדי לרשום השלמה חדשה.',
        actions: [
          { digit: '1', action: 'UPDATE_COMPLETION', url: `${process.env.APP_URL}/api/ivr/extension-2/status` },
          { digit: '#', action: 'CONFIRM', url: `${process.env.APP_URL}/api/ivr/extension-2/confirm` },
        ],
      });

      // שלוחה 3: צפייה בסיכום ההישגים
      const ext3 = await this.setupExtension({
        extensionNumber: 3,
        name: 'סיכום ההישגים',
        greeting: 'כעת תוכלי לשמוע את סיכום ההישגים שלך.',
        actions: [
          { digit: '1', action: 'SUMMARY', url: `${process.env.APP_URL}/api/ivr/extension-3/summary` },
        ],
      });

      return { ext1, ext2, ext3 };
    } catch (error) {
      console.error('Failed to setup extensions:', error);
      throw error;
    }
  }

  // Setup single extension
  async setupExtension(config) {
    try {
      const response = await this.client.post('/ivr/extensions', {
        ...config,
        pbxId: process.env.TECHNOLINE_PBX_ID,
      });
      return response.data;
    } catch (error) {
      console.error(`Failed to setup extension ${config.extensionNumber}:`, error);
      throw error;
    }
  }

  // Handle incoming call
  async handleIncomingCall(callData) {
    try {
      const { callerId, extensionNumber, timestamp } = callData;

      // Verify caller and authenticate
      const userToken = await this.authenticateByPhoneNumber(callerId);

      return {
        success: true,
        token: userToken,
        extension: extensionNumber,
      };
    } catch (error) {
      console.error('Failed to handle incoming call:', error);
      throw error;
    }
  }

  // Authenticate using phone number
  async authenticateByPhoneNumber(phoneNumber) {
    // This would connect to our authentication system
    // For now, a placeholder
    return null;
  }

  // Send voice message
  async sendVoiceMessage(userId, message, language = 'he') {
    try {
      const response = await this.client.post('/ivr/voice-message', {
        userId,
        message,
        language,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to send voice message:', error);
      throw error;
    }
  }

  // Record call
  async recordCall(callId, recordingUrl) {
    try {
      const response = await this.client.post(`/calls/${callId}/record`, {
        recordingUrl,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to record call:', error);
      throw error;
    }
  }

  // Get call details
  async getCallDetails(callId) {
    try {
      const response = await this.client.get(`/calls/${callId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to get call details:', error);
      throw error;
    }
  }

  // Send SMS/Message
  async sendMessage(userId, message) {
    try {
      const response = await this.client.post('/messages/send', {
        userId,
        message,
        type: 'sms',
      });
      return response.data;
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  }
}

module.exports = new TechnolineService();

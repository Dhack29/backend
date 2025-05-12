const axios = require('axios');

class VendorService {
  constructor() {
    // No need for Twilio initialization
  }

  async sendMessage(message, customer) {
    try {
      // Simulate message sending with 90% success rate
      const isSuccess = Math.random() < 0.9;
      
      if (!isSuccess) {
        throw new Error('Simulated message delivery failure');
      }

      // Generate a random message ID
      const messageId = Math.random().toString(36).substring(7);

      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 100));

      return {
        success: true,
        messageId,
        timestamp: new Date(),
        status: 'DELIVERED'
      };
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  async simulateDeliveryReceipt(messageId) {
    // Simulate 95% delivery success rate
    const isDelivered = Math.random() < 0.95;
    
    return {
      messageId,
      status: isDelivered ? 'DELIVERED' : 'FAILED',
      timestamp: new Date(),
      errorMessage: isDelivered ? null : 'Simulated delivery failure'
    };
  }

  mapTwilioStatus(twilioStatus) {
    // Keep this for future Twilio integration
    const statusMap = {
      'queued': 'PENDING',
      'sending': 'PENDING',
      'sent': 'SENT',
      'delivered': 'DELIVERED',
      'undelivered': 'FAILED',
      'failed': 'FAILED'
    };
    return statusMap[twilioStatus] || 'UNKNOWN';
  }
}

module.exports = new VendorService(); 
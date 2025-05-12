const express = require('express');
const router = express.Router();
const axios = require('axios');
const CommunicationLog = require('../models/communicationLog');
const Campaign = require('../models/campaign');

// Simulate vendor API for sending messages
router.post('/send', async (req, res) => {
  try {
    const { campaignId, customerId, message } = req.body;

    // Validate required fields
    if (!campaignId || !customerId || !message) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Simulate 90% success rate
    const isSuccess = Math.random() < 0.9;
    const status = isSuccess ? 'SENT' : 'FAILED';
    const errorMessage = isSuccess ? null : 'Simulated delivery failure';

    // Create communication log entry
    const log = new CommunicationLog({
      campaignId: campaignId,
      customerId: customerId,
      message,
      status,
      deliveryReceipt: {
        status,
        timestamp: new Date(),
        errorMessage
      }
    });

    await log.save();

    // Simulate async delivery receipt
    setTimeout(async () => {
      try {
        // Update campaign stats
        const campaign = await Campaign.findById(campaignId);
        if (campaign) {
          if (status === 'SENT') {
            campaign.stats.sent += 1;
          } else {
            campaign.stats.failed += 1;
          }
          await campaign.save();
        }

        // Call delivery receipt endpoint
        await axios.post('http://localhost:5000/api/vendor/delivery-receipt', {
          logId: log._id,
          status,
          errorMessage
        });
      } catch (error) {
        console.error('Error processing delivery receipt:', error);
      }
    }, 1000); // Simulate 1 second delay

    res.json({
      success: true,
      message: 'Message queued for delivery',
      logId: log._id
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Error sending message' });
  }
});

// Delivery receipt endpoint
router.post('/delivery-receipt', async (req, res) => {
  try {
    const { logId, status, errorMessage } = req.body;

    // Validate required fields
    if (!logId || !status) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Update communication log
    const log = await CommunicationLog.findByIdAndUpdate(
      logId,
      {
        status,
        deliveryTimestamp: new Date(),
        errorMessage
      },
      { new: true }
    );

    if (!log) {
      return res.status(404).json({ error: 'Communication log not found' });
    }

    res.json({
      success: true,
      message: 'Delivery receipt processed',
      log
    });
  } catch (error) {
    console.error('Error processing delivery receipt:', error);
    res.status(500).json({ error: 'Error processing delivery receipt' });
  }
});

module.exports = router; 
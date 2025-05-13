const express = require('express');
const router = express.Router();
const axios = require('axios');
const retryService = require('../services/RetryService');
const CommunicationLog = require('../models/CommunicationLog');
const { vendorLimiter } = require('../middleware/rateLimit');

// Apply rate limiting to all vendor routes
router.use(vendorLimiter);

// Dummy Vendor API: Simulate delivery and call receipt API
router.post('/send', async (req, res) => {
  const { logId, customer, message, isRetry, attempt } = req.body;

  // Simulate delivery result: 90% SENT, 10% FAILED
  // For retries, increase success rate by 10% each attempt
  const successRate = isRetry ? 0.9 + (attempt * 0.1) : 0.9;
  const isSent = Math.random() < successRate;
  const status = isSent ? 'SENT' : 'FAILED';
  const vendorMessageId = Math.random().toString(36).substring(2, 12);

  // Simulate network delay (shorter for retries)
  const delay = isRetry ? 200 + Math.random() * 300 : 500 + Math.random() * 1000;

  setTimeout(async () => {
    try {
      // Call Delivery Receipt API
      await axios.post('http://localhost:5000/api/receipts', {
        logId,
        status,
        vendorMessageId
      });

      // If failed and not a retry, schedule retry
      if (status === 'FAILED' && !isRetry) {
        const log = await CommunicationLog.findById(logId);
        if (log) {
          await retryService.scheduleRetry(logId, customer, message);
        }
      }
    } catch (err) {
      console.error('Error processing delivery receipt:', err);
      // If receipt API fails and not a retry, schedule retry
      if (!isRetry) {
        await retryService.scheduleRetry(logId, customer, message);
      }
    }
  }, delay);

  res.json({ 
    success: true, 
    status, 
    vendorMessageId,
    isRetry,
    attempt: attempt || 0
  });
});

// Get retry statistics for a campaign
router.get('/retry-stats/:campaignId', async (req, res) => {
  try {
    const stats = await retryService.getRetryStats(req.params.campaignId);
    res.json(stats);
  } catch (error) {
    console.error('Error getting retry stats:', error);
    res.status(500).json({ message: 'Error getting retry statistics' });
  }
});

module.exports = router; 
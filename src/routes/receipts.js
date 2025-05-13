const express = require('express');
const router = express.Router();
const batchProcessor = require('../services/BatchProcessor');
const { receiptLimiter } = require('../middleware/rateLimit');

// Apply rate limiting to all receipt routes
router.use(receiptLimiter);

// Delivery Receipt API: Update log status using batch processing
router.post('/', async (req, res) => {
  const { logId, status, vendorMessageId } = req.body;
  
  if (!logId || !status) {
    return res.status(400).json({ message: 'logId and status are required' });
  }

  try {
    // Add to batch processor
    await batchProcessor.addReceipt(logId, {
      status,
      vendorMessageId,
      deliveryTime: new Date()
    });
    
    res.json({ success: true, message: 'Receipt queued for processing' });
  } catch (error) {
    console.error('Error queueing receipt:', error);
    res.status(500).json({ message: 'Error processing receipt' });
  }
});

module.exports = router; 
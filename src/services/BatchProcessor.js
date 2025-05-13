const CommunicationLog = require('../models/CommunicationLog');
const Campaign = require('../models/Campaign');

class BatchProcessor {
  constructor(batchSize = 100, flushInterval = 5000) {
    this.batchSize = batchSize;
    this.flushInterval = flushInterval;
    this.batch = new Map(); // Map of logId -> update data
    this.timer = null;
    this.isProcessing = false;
  }

  // Add a receipt to the batch
  async addReceipt(logId, updateData) {
    this.batch.set(logId, updateData);
    
    // If batch is full, process it immediately
    if (this.batch.size >= this.batchSize) {
      await this.flush();
    }
    
    // Start timer if not already running
    if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.flushInterval);
    }
  }

  // Process the current batch
  async flush() {
    if (this.isProcessing || this.batch.size === 0) return;
    
    try {
      this.isProcessing = true;
      const updates = Array.from(this.batch.entries()).map(([logId, data]) => ({
        updateOne: {
          filter: { _id: logId },
          update: {
            $set: {
              status: data.status,
              vendorMessageId: data.vendorMessageId,
              deliveryTime: data.deliveryTime || new Date()
            }
          }
        }
      }));

      if (updates.length > 0) {
        const result = await CommunicationLog.bulkWrite(updates, { ordered: false });
        // For each update, if status is SENT, increment delivered metric
        for (const [logId, data] of this.batch.entries()) {
          if (data.status === 'SENT') {
            const log = await CommunicationLog.findById(logId);
            if (log && log.campaignId) {
              await Campaign.findByIdAndUpdate(log.campaignId, { $inc: { 'metrics.delivered': 1 } });
            }
          }
        }
        console.log(`Processed ${updates.length} delivery receipts in batch`);
      }
    } catch (error) {
      console.error('Error processing batch:', error);
      // On error, retry individual updates
      for (const [logId, data] of this.batch.entries()) {
        try {
          const updatedLog = await CommunicationLog.findByIdAndUpdate(logId, {
            status: data.status,
            vendorMessageId: data.vendorMessageId,
            deliveryTime: data.deliveryTime || new Date()
          }, { new: true });
          if (data.status === 'SENT' && updatedLog && updatedLog.campaignId) {
            await Campaign.findByIdAndUpdate(updatedLog.campaignId, { $inc: { 'metrics.delivered': 1 } });
          }
        } catch (err) {
          console.error(`Failed to update log ${logId}:`, err);
        }
      }
    } finally {
      this.batch.clear();
      this.isProcessing = false;
      if (this.timer) {
        clearTimeout(this.timer);
        this.timer = null;
      }
    }
  }
}

// Create singleton instance
const batchProcessor = new BatchProcessor();

module.exports = batchProcessor; 
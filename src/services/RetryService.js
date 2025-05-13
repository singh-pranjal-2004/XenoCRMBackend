const CommunicationLog = require('../models/CommunicationLog');
const axios = require('axios');

class RetryService {
  constructor(maxRetries = 3, initialDelay = 1000) {
    this.maxRetries = maxRetries;
    this.initialDelay = initialDelay;
    this.retryQueue = new Map(); // Map of logId -> retry attempt
  }

  // Calculate delay with exponential backoff
  getDelay(attempt) {
    return Math.min(this.initialDelay * Math.pow(2, attempt), 30000); // Max 30 seconds
  }

  // Schedule a retry for a failed delivery
  async scheduleRetry(logId, customer, message) {
    const attempt = (this.retryQueue.get(logId) || 0) + 1;
    
    if (attempt > this.maxRetries) {
      console.log(`Max retries reached for log ${logId}`);
      this.retryQueue.delete(logId);
      return;
    }

    this.retryQueue.set(logId, attempt);
    const delay = this.getDelay(attempt);

    console.log(`Scheduling retry ${attempt} for log ${logId} in ${delay}ms`);

    setTimeout(async () => {
      try {
        // Call vendor API again
        const response = await axios.post('http://localhost:5000/api/vendor/send', {
          logId,
          customer,
          message,
          isRetry: true,
          attempt
        });

        // If still failed, schedule another retry
        if (response.data.status === 'FAILED') {
          await this.scheduleRetry(logId, customer, message);
        } else {
          this.retryQueue.delete(logId);
        }
      } catch (error) {
        console.error(`Retry attempt ${attempt} failed for log ${logId}:`, error);
        // Schedule another retry on error
        await this.scheduleRetry(logId, customer, message);
      }
    }, delay);
  }

  // Get retry statistics for a campaign
  async getRetryStats(campaignId) {
    const logs = await CommunicationLog.find({ 
      campaignId,
      status: 'FAILED'
    });

    const stats = {
      totalFailed: logs.length,
      retryAttempts: new Map(),
      maxRetriesReached: 0
    };

    for (const log of logs) {
      const attempt = this.retryQueue.get(log._id.toString()) || 0;
      stats.retryAttempts.set(log._id.toString(), attempt);
      if (attempt >= this.maxRetries) {
        stats.maxRetriesReached++;
      }
    }

    // Convert retryAttempts Map to a plain object for frontend compatibility
    stats.retryAttempts = Object.fromEntries(stats.retryAttempts);

    return stats;
  }
}

// Create singleton instance
const retryService = new RetryService();

module.exports = retryService; 
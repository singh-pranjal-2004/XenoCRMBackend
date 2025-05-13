const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'active', 'completed', 'paused'],
    default: 'draft'
  },
  type: {
    type: String,
    enum: ['email', 'sms', 'push', 'multi-channel'],
    required: true
  },
  segmentationRules: {
    type: [{
      field: String,
      operator: {
        type: String,
        enum: ['equals', 'notEquals', 'contains', 'notContains', 'greaterThan', 'lessThan', 'in', 'notIn']
      },
      value: mongoose.Schema.Types.Mixed
    }],
    default: []
  },
  content: {
    subject: String,
    body: String,
    template: String
  },
  schedule: {
    startDate: Date,
    endDate: Date,
    frequency: {
      type: String,
      enum: ['once', 'daily', 'weekly', 'monthly'],
      default: 'once'
    }
  },
  targetAudience: {
    type: String,
    trim: true
  },
  metrics: {
    totalRecipients: {
      type: Number,
      default: 0
    },
    delivered: {
      type: Number,
      default: 0
    },
    opened: {
      type: Number,
      default: 0
    },
    clicked: {
      type: Number,
      default: 0
    },
    bounced: {
      type: Number,
      default: 0
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for faster queries
campaignSchema.index({ status: 1 });
campaignSchema.index({ 'schedule.startDate': 1 });
campaignSchema.index({ createdBy: 1 });

module.exports = mongoose.model('Campaign', campaignSchema); 
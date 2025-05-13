const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    trim: true
  },
  company: {
    type: String,
    trim: true
  },
  tags: [{
    type: String,
    trim: true
  }],
  customFields: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'lead'],
    default: 'lead'
  },
  totalSpend: {
    type: Number,
    default: 0,
    min: 0
  },
  visits: {
    type: Number,
    default: 0,
    min: 0
  },
  lastActiveDay: {
    type: Date,
    default: Date.now
  },
  lastContact: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  birthday: {
    type: Date
  },
  anniversary: {
    type: Date
  },
  lastPurchaseDate: {
    type: Date
  },
  hasAbandonedCart: {
    type: Boolean,
    default: false
  },
  segment: {
    type: String,
    enum: ['newCustomer', 'active', 'inactive', 'highValue'],
    default: 'newCustomer'
  },
  preferences: {
    preferredChannel: {
      type: String,
      enum: ['email', 'sms', 'push'],
      default: 'email'
    },
    language: {
      type: String,
      default: 'en'
    }
  }
}, {
  timestamps: true
});

// Index for faster queries
customerSchema.index({ email: 1 });
customerSchema.index({ tags: 1 });
customerSchema.index({ status: 1 });
customerSchema.index({ lastActiveDay: 1 });
customerSchema.index({ totalSpend: 1 });

// Update segment based on behavior
customerSchema.methods.updateSegment = function() {
  const now = new Date();
  const daysSinceLastActive = Math.floor((now - this.lastActiveDay) / (1000 * 60 * 60 * 24));
  const daysSinceLastPurchase = this.lastPurchaseDate ? 
    Math.floor((now - this.lastPurchaseDate) / (1000 * 60 * 60 * 24)) : 
    Infinity;

  if (daysSinceLastActive > 30) {
    this.segment = 'inactive';
  } else if (this.totalSpend > 1000) {
    this.segment = 'highValue';
  } else if (daysSinceLastPurchase < 30) {
    this.segment = 'active';
  } else {
    this.segment = 'newCustomer';
  }
};

// Update last active timestamp
customerSchema.methods.updateLastActive = function() {
  this.lastActiveDay = new Date();
  this.updateSegment();
};

module.exports = mongoose.model('Customer', customerSchema); 
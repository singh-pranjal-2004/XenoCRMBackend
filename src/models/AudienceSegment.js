const mongoose = require('mongoose');

const audienceSegmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  rules: [
    {
      field: String,
      operator: String,
      value: mongoose.Schema.Types.Mixed
    }
  ],
  logic: {
    type: String,
    enum: ['AND', 'OR'],
    default: 'AND'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('AudienceSegment', audienceSegmentSchema); 
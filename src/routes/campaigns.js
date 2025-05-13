const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Campaign = require('../models/Campaign');
const Customer = require('../models/Customer');
const { auth, checkRole } = require('../middleware/auth');
const CommunicationLog = require('../models/CommunicationLog');
const messageTemplateService = require('../services/MessageTemplateService');
const axios = require('axios');
const mongoose = require('mongoose');
const { campaignDeliveryLimiter } = require('../middleware/rateLimit');
const path = require('path');
const fs = require('fs');

// Get all campaigns with pagination
router.get('/', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const campaigns = await Campaign.find()
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .populate('createdBy', 'firstName lastName email');

    const total = await Campaign.countDocuments();

    res.json({
      campaigns,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalCampaigns: total
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single campaign
router.get('/:id', auth, async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id)
      .populate('createdBy', 'firstName lastName email');
    
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    // Fetch all delivery logs for this campaign
    const logs = await CommunicationLog.find({ campaignId: campaign._id })
      .populate('customerId', 'firstName lastName email');
    res.json({ campaign, logs });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new campaign
router.post('/', [
  auth,
  body('name').trim().notEmpty(),
  body('type').isIn(['email', 'sms', 'push', 'multi-channel']),
  body('content.subject').optional().trim(),
  body('content.body').optional().trim(),
  body('content.template').optional().trim(),
  body('schedule.startDate').optional().isISO8601(),
  body('schedule.endDate').optional().isISO8601(),
  body('schedule.frequency').optional().isIn(['once', 'daily', 'weekly', 'monthly']),
  body('segmentationRules').optional().isArray()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const campaign = new Campaign({
      ...req.body,
      createdBy: req.user._id
    });

    await campaign.save();
    res.status(201).json(campaign);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update campaign
router.put('/:id', [
  auth,
  body('name').optional().trim().notEmpty(),
  body('type').optional().isIn(['email', 'sms', 'push', 'multi-channel']),
  body('status').optional().isIn(['draft', 'scheduled', 'active', 'completed', 'paused']),
  body('content.subject').optional().trim(),
  body('content.body').optional().trim(),
  body('content.template').optional().trim(),
  body('schedule.startDate').optional().isISO8601(),
  body('schedule.endDate').optional().isISO8601(),
  body('schedule.frequency').optional().isIn(['once', 'daily', 'weekly', 'monthly']),
  body('segmentationRules').optional().isArray()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    // Remove status check: allow editing any campaign
    Object.assign(campaign, req.body);
    await campaign.save();

    res.json(campaign);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete campaign
router.delete('/:id', auth, async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    // Remove status check: allow deleting any campaign
    await campaign.deleteOne();
    res.json({ message: 'Campaign deleted successfully' });
  } catch (error) {
    console.error('Delete campaign error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get campaign metrics
router.get('/:id/metrics', auth, async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    res.json(campaign.metrics);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get campaign recipients based on segmentation rules
router.get('/:id/recipients', auth, async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    // Build query based on segmentation rules
    const query = {};
    campaign.segmentationRules.forEach(rule => {
      switch (rule.operator) {
        case 'equals':
          query[rule.field] = rule.value;
          break;
        case 'notEquals':
          query[rule.field] = { $ne: rule.value };
          break;
        case 'contains':
          query[rule.field] = { $regex: rule.value, $options: 'i' };
          break;
        case 'notContains':
          query[rule.field] = { $not: { $regex: rule.value, $options: 'i' } };
          break;
        case 'greaterThan':
          query[rule.field] = { $gt: rule.value };
          break;
        case 'lessThan':
          query[rule.field] = { $lt: rule.value };
          break;
        case 'in':
          query[rule.field] = { $in: rule.value };
          break;
        case 'notIn':
          query[rule.field] = { $nin: rule.value };
          break;
      }
    });

    const customers = await Customer.find(query);
    res.json(customers);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Initiate campaign delivery with rate limiting
router.post('/:id/deliver', [
  auth,
  campaignDeliveryLimiter
], async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    // Build query based on segmentation rules (reuse logic from recipients endpoint)
    const query = {};
    campaign.segmentationRules.forEach(rule => {
      switch (rule.operator) {
        case 'equals':
          query[rule.field] = rule.value;
          break;
        case 'notEquals':
          query[rule.field] = { $ne: rule.value };
          break;
        case 'contains':
          query[rule.field] = { $regex: rule.value, $options: 'i' };
          break;
        case 'notContains':
          query[rule.field] = { $not: { $regex: rule.value, $options: 'i' } };
          break;
        case 'greaterThan':
          query[rule.field] = { $gt: rule.value };
          break;
        case 'lessThan':
          query[rule.field] = { $lt: rule.value };
          break;
        case 'in':
          query[rule.field] = { $in: rule.value };
          break;
        case 'notIn':
          query[rule.field] = { $nin: rule.value };
          break;
      }
    });

    // Add targetAudience filter if set
    if (campaign.targetAudience) {
      query.status = campaign.targetAudience;
    }

    const customers = await Customer.find(query);
    let started = 0;

    // Process customers in parallel with a concurrency limit
    const concurrencyLimit = 10;
    const chunks = [];
    for (let i = 0; i < customers.length; i += concurrencyLimit) {
      chunks.push(customers.slice(i, i + concurrencyLimit));
    }

    for (const chunk of chunks) {
      await Promise.all(chunk.map(async (customer) => {
        try {
          // Generate personalized message based on customer data and campaign
          const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
          const { subject, html } = await messageTemplateService.generateMessage(customer, campaign, { baseUrl });

          // Create log entry
          const log = await CommunicationLog.create({
            campaignId: campaign._id,
            customerId: customer._id,
            message: html,
            status: 'PENDING'
          });

          // Call vendor API (simulate async)
          await axios.post('http://localhost:5000/api/vendor/send', {
            logId: log._id,
            customer,
            message: html,
            channel: campaign.type
          });

          started++;
        } catch (error) {
          console.error(`Error processing customer ${customer._id}:`, error);
        }
      }));
    }

    // Update campaign metrics
    campaign.metrics.totalRecipients = customers.length;
    campaign.metrics.delivered = 0; // Will be updated by receipt API
    await campaign.save();

    res.json({ 
      success: true, 
      total: customers.length, 
      started,
      message: `Campaign delivery initiated for ${started} customers`
    });
  } catch (error) {
    console.error('Campaign delivery error:', error);
    res.status(500).json({ message: 'Error initiating campaign delivery' });
  }
});

// Get delivery stats for a campaign
router.get('/:id/stats', async (req, res) => {
  try {
    const campaignId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(campaignId)) {
      return res.status(400).json({ message: 'Invalid campaign ID' });
    }
    const campaignObjectId = new mongoose.Types.ObjectId(campaignId);
    const stats = await CommunicationLog.aggregate([
      { $match: { campaignId: campaignObjectId } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    // Format as { sent: X, failed: 0, pending: 0 }
    const result = { sent: 0, failed: 0, pending: 0 };
    stats.forEach(s => {
      if (s._id === 'SENT') result.sent = s.count;
      else if (s._id === 'FAILED') result.failed = s.count;
      else if (s._id === 'PENDING') result.pending = s.count;
    });
    res.json(result);
  } catch (err) {
    console.error('Error in /api/campaigns/:id/stats:', err);
    res.status(500).json({ message: 'Failed to get delivery stats', error: err.message });
  }
});

// Open tracking pixel endpoint
router.get('/track/open/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;
    await Campaign.findByIdAndUpdate(campaignId, { $inc: { 'metrics.opened': 1 } });
    // Serve a 1x1 transparent PNG
    const pixel = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X2ZkAAAAASUVORK5CYII=',
      'base64'
    );
    res.set('Content-Type', 'image/png');
    return res.end(pixel, 'binary');
  } catch (err) {
    res.status(500).end();
  }
});

// Click tracking redirect endpoint
router.get('/track/click/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { url } = req.query;
    if (!url) return res.status(400).send('Missing url');
    await Campaign.findByIdAndUpdate(campaignId, { $inc: { 'metrics.clicked': 1 } });
    return res.redirect(url);
  } catch (err) {
    res.status(500).send('Error tracking click');
  }
});

// TEMP: Set random metrics for testing
router.post('/:id/set-random-metrics', async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
    // Generate random values
    const totalRecipients = Math.floor(Math.random() * 10) + 1;
    const delivered = Math.floor(Math.random() * (totalRecipients + 1));
    const opened = Math.floor(Math.random() * (delivered + 1));
    const clicked = Math.floor(Math.random() * (opened + 1));
    campaign.metrics.totalRecipients = totalRecipients;
    campaign.metrics.delivered = delivered;
    campaign.metrics.opened = opened;
    campaign.metrics.clicked = clicked;
    await campaign.save();
    res.json({ message: 'Random metrics set', metrics: campaign.metrics });
  } catch (err) {
    res.status(500).json({ message: 'Error setting random metrics' });
  }
});

// TEMP: Set description for a campaign (for testing)
router.post('/:id/set-description', async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
    const { description } = req.body;
    campaign.description = description || `This is a test description for campaign ${campaign.name}.`;
    await campaign.save();
    res.json({ message: 'Description set', description: campaign.description });
  } catch (err) {
    res.status(500).json({ message: 'Error setting description' });
  }
});

module.exports = router; 
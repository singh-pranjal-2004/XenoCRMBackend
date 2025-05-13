const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');
const AudienceSegment = require('../models/AudienceSegment');
const Campaign = require('../models/Campaign');
const CommunicationLog = require('../models/CommunicationLog');
const { auth } = require('../middleware/auth');
const axios = require('axios');

// Preview audience size
router.post('/preview', auth, async (req, res) => {
  const { rules, logic } = req.body;
  if (!Array.isArray(rules) || !logic) {
    return res.status(400).json({ message: 'Invalid rules or logic' });
  }

  // Build MongoDB query
  const mongoRules = rules.map(rule => {
    let cond = {};
    const field = rule.field === 'spend' ? 'totalSpend' : 
                 rule.field === 'inactiveDays' ? 'lastActiveDay' : 
                 rule.field;

    switch (rule.operator) {
      case '>':
        cond[field] = { $gt: parseFloat(rule.value) };
        break;
      case '<':
        cond[field] = { $lt: parseFloat(rule.value) };
        break;
      case '>=':
        cond[field] = { $gte: parseFloat(rule.value) };
        break;
      case '<=':
        cond[field] = { $lte: parseFloat(rule.value) };
        break;
      case '==':
        if (field === 'lastActiveDay') {
          // For inactive days, calculate the date X days ago
          const daysAgo = new Date();
          daysAgo.setDate(daysAgo.getDate() - parseInt(rule.value));
          cond[field] = { $lte: daysAgo };
        } else {
          cond[field] = rule.value;
        }
        break;
      case '!=':
        cond[field] = { $ne: rule.value };
        break;
      default:
        cond[field] = rule.value;
    }
    return cond;
  });

  let query = {};
  if (logic === 'AND') {
    query = mongoRules.length > 0 ? { $and: mongoRules } : {};
  } else if (logic === 'OR') {
    query = mongoRules.length > 0 ? { $or: mongoRules } : {};
  }

  try {
    const size = await Customer.countDocuments(query);
    res.json({ size });
  } catch (err) {
    console.error('Preview error:', err);
    res.status(500).json({ message: 'Failed to preview audience size', error: err.message });
  }
});

// Save a new audience segment and create/deliver a campaign
router.post('/', auth, async (req, res) => {
  const { name, rules, logic, startDate, endDate, targetAudience } = req.body;
  if (!name || !Array.isArray(rules) || !logic) {
    return res.status(400).json({ message: 'Name, rules, and logic are required' });
  }
  try {
    // 1. Save the segment
    const segment = new AudienceSegment({
      name,
      rules,
      logic,
      createdBy: req.user._id
    });
    await segment.save();

    // 2. Create a campaign using the segment's rules/logic
    const campaign = new Campaign({
      name: `Campaign for: ${name}`,
      type: 'email',
      status: 'active',
      segmentationRules: rules.map(rule => ({
        field: rule.field === 'spend' ? 'totalSpend' : 
               rule.field === 'inactiveDays' ? 'lastActiveDay' : 
               rule.field,
        operator: rule.operator === '>' ? 'greaterThan' :
                 rule.operator === '<' ? 'lessThan' :
                 rule.operator === '>=' ? 'greaterThan' :
                 rule.operator === '<=' ? 'lessThan' :
                 rule.operator === '==' ? 'equals' :
                 rule.operator === '!=' ? 'notEquals' : 'equals',
        value: rule.value
      })),
      content: {
        subject: 'Special Offer!',
        body: "Hi {{firstName}}, here's 10% off on your next order!"
      },
      schedule: {
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        frequency: 'once'
      },
      targetAudience: targetAudience || name,
      createdBy: req.user._id
    });
    await campaign.save();

    // 3. Find matching customers using the same query logic as preview
    const mongoRules = rules.map(rule => {
      let cond = {};
      const field = rule.field === 'spend' ? 'totalSpend' : 
                   rule.field === 'inactiveDays' ? 'lastActiveDay' : 
                   rule.field;

      switch (rule.operator) {
        case '>':
          cond[field] = { $gt: parseFloat(rule.value) };
          break;
        case '<':
          cond[field] = { $lt: parseFloat(rule.value) };
          break;
        case '>=':
          cond[field] = { $gte: parseFloat(rule.value) };
          break;
        case '<=':
          cond[field] = { $lte: parseFloat(rule.value) };
          break;
        case '==':
          if (field === 'lastActiveDay') {
            const daysAgo = new Date();
            daysAgo.setDate(daysAgo.getDate() - parseInt(rule.value));
            cond[field] = { $lte: daysAgo };
          } else {
            cond[field] = rule.value;
          }
          break;
        case '!=':
          cond[field] = { $ne: rule.value };
          break;
        default:
          cond[field] = rule.value;
      }
      return cond;
    });

    let query = {};
    if (logic === 'AND') {
      query = mongoRules.length > 0 ? { $and: mongoRules } : {};
    } else if (logic === 'OR') {
      query = mongoRules.length > 0 ? { $or: mongoRules } : {};
    }

    const customers = await Customer.find(query);

    // 4. Create communication logs and initiate delivery
    for (const customer of customers) {
      const personalizedMsg = `Hi ${customer.firstName}, here's 10% off on your next order!`;
      const log = await CommunicationLog.create({
        campaignId: campaign._id,
        customerId: customer._id,
        message: personalizedMsg,
        status: 'PENDING'
      });

      // Simulate vendor API call (async)
      axios.post('http://localhost:5000/api/vendor/send', {
        logId: log._id,
        customer,
        message: personalizedMsg
      }).catch(err => console.error('Vendor API error:', err));
    }

    // Update campaign metrics
    campaign.metrics.totalRecipients = customers.length;
    await campaign.save();

    res.status(201).json({ 
      segment, 
      campaign,
      message: `Campaign created and delivery initiated for ${customers.length} customers`
    });
  } catch (err) {
    console.error('Segment creation error:', err);
    res.status(500).json({ message: 'Failed to save segment and create campaign', error: err.message });
  }
});

module.exports = router; 
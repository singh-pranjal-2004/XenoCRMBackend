const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Customer = require('../models/Customer');
const { auth, checkRole } = require('../middleware/auth');

// Get all customers with pagination
router.get('/', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const customers = await Customer.find()
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await Customer.countDocuments();

    res.json({
      customers,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalCustomers: total
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single customer
router.get('/:id', auth, async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    res.json(customer);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new customer
router.post('/', [
  auth,
  body('firstName').trim().notEmpty(),
  body('lastName').trim().notEmpty(),
  body('email').isEmail().normalizeEmail(),
  body('phone').optional().trim(),
  body('status').optional().isIn(['active', 'inactive', 'lead']),
  body('totalSpend').optional().isFloat({ min: 0 }).toFloat(),
  body('visits').optional().isInt({ min: 0 }).toInt(),
  body('lastActiveDay').optional().isISO8601().toDate()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const customer = new Customer({
      ...req.body,
      createdBy: req.user._id
    });

    await customer.save();
    res.status(201).json(customer);
  } catch (error) {
    console.error('Customer creation error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Email already exists' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Update customer
router.put('/:id', [
  auth,
  body('firstName').optional().trim().notEmpty(),
  body('lastName').optional().trim().notEmpty(),
  body('email').optional().isEmail().normalizeEmail(),
  body('phone').optional().trim(),
  body('status').optional().isIn(['active', 'inactive', 'lead']),
  body('totalSpend').optional().isFloat({ min: 0 }).toFloat(),
  body('visits').optional().isInt({ min: 0 }).toInt(),
  body('lastActiveDay').optional().isISO8601().toDate()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    res.json(customer);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Email already exists' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete customer
router.delete('/:id', [auth, checkRole(['admin', 'manager'])], async (req, res) => {
  try {
    const customer = await Customer.findByIdAndDelete(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    res.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Search customers
router.get('/search', auth, async (req, res) => {
  try {
    const { query } = req.query;
    const searchRegex = new RegExp(query, 'i');

    const customers = await Customer.find({
      $or: [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
        { company: searchRegex },
        { tags: searchRegex }
      ]
    }).limit(10);

    res.json(customers);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 
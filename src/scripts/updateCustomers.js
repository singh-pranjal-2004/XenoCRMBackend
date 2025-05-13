const mongoose = require('mongoose');
require('dotenv').config();
const Customer = require('../models/Customer');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

async function updateCustomers() {
  try {
    // Get all customers
    const customers = await Customer.find({});
    console.log(`Found ${customers.length} customers to update`);

    // Update each customer with random but reasonable data
    for (const customer of customers) {
      const updates = {
        // Random total spend between 1000 and 50000
        totalSpend: Math.floor(Math.random() * 49000) + 1000,
        // Random visits between 1 and 20
        visits: Math.floor(Math.random() * 19) + 1,
        // Random last active date within last 30 days
        lastActiveDay: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000)
      };

      await Customer.findByIdAndUpdate(customer._id, updates);
      console.log(`Updated customer: ${customer.firstName} ${customer.lastName}`);
    }

    console.log('All customers updated successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error updating customers:', error);
    process.exit(1);
  }
}

// Run the update
updateCustomers(); 
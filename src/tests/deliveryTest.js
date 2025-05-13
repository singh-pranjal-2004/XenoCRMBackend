const axios = require('axios');
const mongoose = require('mongoose');
const Customer = require('../models/Customer');
const Campaign = require('../models/Campaign');
const CommunicationLog = require('../models/CommunicationLog');

// Test configuration
const TEST_CONFIG = {
  baseUrl: 'http://localhost:5000/api',
  numCustomers: 50,  // Number of test customers to create
  campaignName: 'Test Campaign - Delivery System',
  batchSize: 100,    // Match BatchProcessor batch size
  testDuration: 30000 // 30 seconds test duration
};

// Helper function to create test customer
async function createTestCustomer(index) {
  const customer = new Customer({
    firstName: `Test${index}`,
    lastName: `User${index}`,
    email: `test${index}@example.com`,
    phone: `+1234567890${index}`,
    totalSpend: Math.random() * 2000, // Random spend between 0-2000
    lastActiveDay: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Random last active date
    segment: ['newCustomer', 'active', 'inactive', 'highValue'][Math.floor(Math.random() * 4)],
    preferences: {
      preferredChannel: ['email', 'sms', 'push'][Math.floor(Math.random() * 3)]
    }
  });
  await customer.save();
  return customer;
}

// Helper function to create test campaign
async function createTestCampaign() {
  const campaign = new Campaign({
    name: TEST_CONFIG.campaignName,
    type: 'email',
    status: 'active',
    content: {
      subject: 'Test Campaign',
      body: 'Test message'
    },
    createdBy: new mongoose.Types.ObjectId(), // Dummy user ID
    metrics: {
      totalRecipients: 0,
      delivered: 0,
      opened: 0,
      clicked: 0
    }
  });
  await campaign.save();
  return campaign;
}

// Test delivery simulation
async function testDeliverySimulation() {
  console.log('\n=== Testing Delivery Simulation ===');
  
  // Create test customers
  console.log('Creating test customers...');
  const customers = [];
  for (let i = 0; i < TEST_CONFIG.numCustomers; i++) {
    customers.push(await createTestCustomer(i));
  }
  console.log(`Created ${customers.length} test customers`);

  // Create test campaign
  console.log('Creating test campaign...');
  const campaign = await createTestCampaign();
  console.log('Test campaign created:', campaign.name);

  // Initiate campaign delivery
  console.log('\nInitiating campaign delivery...');
  const startTime = Date.now();
  const response = await axios.post(`${TEST_CONFIG.baseUrl}/campaigns/${campaign._id}/deliver`);
  console.log('Delivery initiated:', response.data);

  // Monitor delivery status
  console.log('\nMonitoring delivery status...');
  let stats = { sent: 0, failed: 0, pending: 0 };
  let lastUpdate = Date.now();

  const monitorInterval = setInterval(async () => {
    try {
      // Get delivery stats
      const statsResponse = await axios.get(`${TEST_CONFIG.baseUrl}/campaigns/${campaign._id}/stats`);
      const currentStats = statsResponse.data;
      
      // Get retry stats
      const retryResponse = await axios.get(`${TEST_CONFIG.baseUrl}/vendor/retry-stats/${campaign._id}`);
      const retryStats = retryResponse.data;

      // Calculate rates
      const total = currentStats.sent + currentStats.failed + currentStats.pending;
      const successRate = total > 0 ? (currentStats.sent / total * 100).toFixed(1) : 0;
      
      // Print status update
      console.log('\n=== Delivery Status Update ===');
      console.log(`Time elapsed: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
      console.log(`Total messages: ${total}`);
      console.log(`Success rate: ${successRate}%`);
      console.log('Status breakdown:');
      console.log(`- Sent: ${currentStats.sent}`);
      console.log(`- Failed: ${currentStats.failed}`);
      console.log(`- Pending: ${currentStats.pending}`);
      console.log('Retry stats:');
      console.log(`- Total failed: ${retryStats.totalFailed}`);
      console.log(`- Retry attempts: ${Array.from(retryStats.retryAttempts.values()).reduce((a, b) => a + b, 0)}`);
      console.log(`- Max retries reached: ${retryStats.maxRetriesReached}`);

      // Check if delivery is complete
      if (currentStats.pending === 0 || Date.now() - startTime > TEST_CONFIG.testDuration) {
        clearInterval(monitorInterval);
        console.log('\n=== Test Complete ===');
        
        // Verify batch processing
        const logs = await CommunicationLog.find({ campaignId: campaign._id });
        const batchUpdates = logs.filter(log => log.deliveryTime).length;
        console.log(`Total messages processed: ${logs.length}`);
        console.log(`Messages updated in batches: ${batchUpdates}`);
        
        // Cleanup
        console.log('\nCleaning up test data...');
        await Promise.all([
          Customer.deleteMany({ email: /^test\d+@example.com$/ }),
          Campaign.deleteOne({ _id: campaign._id }),
          CommunicationLog.deleteMany({ campaignId: campaign._id })
        ]);
        console.log('Cleanup complete');
        
        process.exit(0);
      }

      // Update last update time
      lastUpdate = Date.now();
    } catch (error) {
      console.error('Error monitoring delivery:', error.message);
    }
  }, 2000); // Check every 2 seconds
}

// Run the test
console.log('Starting delivery system test...');
testDeliverySimulation().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
}); 
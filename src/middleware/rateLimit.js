const rateLimit = require('express-rate-limit');

// Create different limiters for different endpoints
const createLimiter = (windowMs, max, message) => rateLimit({
  windowMs,
  max,
  message: { message },
  standardHeaders: true,
  legacyHeaders: false,
});

// Vendor API limiter: 100 requests per minute
const vendorLimiter = createLimiter(
  60 * 1000, // 1 minute
  100,
  'Too many requests to vendor API, please try again later'
);

// Receipt API limiter: 200 requests per minute
const receiptLimiter = createLimiter(
  60 * 1000, // 1 minute
  200,
  'Too many receipt updates, please try again later'
);

// Campaign delivery limiter: 10 campaigns per hour
const campaignDeliveryLimiter = createLimiter(
  60 * 60 * 1000, // 1 hour
  10,
  'Too many campaign deliveries, please try again later'
);

module.exports = {
  vendorLimiter,
  receiptLimiter,
  campaignDeliveryLimiter
}; 
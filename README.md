# 🚀 XenoCRM Backend

Welcome to the backend of **XenoCRM** – a powerful, scalable API service that powers our creative, AI-powered campaign CRM!

## 🌟 Core Features

- **RESTful API Endpoints** for customers, orders, and campaigns
- **Batch Processing** for campaign delivery and receipt handling
- **AI Integration** with Google Gemini for insights and message suggestions
- **MongoDB Integration** for robust data storage
- **Open/Click Tracking** endpoints for campaign analytics
- **Testing & Simulation** endpoints for development

## 🛠️ Tech Stack

- Node.js & Express.js
- MongoDB with Mongoose
- Google Gemini AI API
- JWT Authentication
- Jest for Testing

## 🚦 Quick Start

1. **Install dependencies:**
   ```bash
   cd backend
   npm install
   ```

2. **Environment Setup:**
   - Copy `.env.example` to `.env`
   - Configure the following variables:
     ```
     MONGODB_URI=your_mongodb_uri
     JWT_SECRET=your_jwt_secret
     GEMINI_API_KEY=your_gemini_api_key
     PORT=5000
     ```

3. **Run the server:**
   ```bash
   npm start
   ```

## 📚 API Documentation

### Authentication Endpoints
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration

### Campaign Endpoints
- `GET /api/campaigns` - List all campaigns
- `POST /api/campaigns` - Create new campaign
- `GET /api/campaigns/:id` - Get campaign details
- `GET /api/campaigns/:id/stats` - Get campaign statistics
- `POST /api/campaigns/:id/start` - Start campaign delivery
- `POST /api/campaigns/:id/stop` - Stop campaign delivery

### Customer Endpoints
- `GET /api/customers` - List all customers
- `POST /api/customers` - Create new customer
- `GET /api/customers/:id` - Get customer details

### Order Endpoints
- `GET /api/orders` - List all orders
- `POST /api/orders` - Create new order
- `GET /api/orders/:id` - Get order details

### Tracking Endpoints
- `GET /track/open/:campaignId/:customerId` - Track email opens
- `GET /track/click/:campaignId/:customerId/:linkId` - Track link clicks

### Testing Endpoints
- `POST /api/test/set-random-metrics/:campaignId` - Set random metrics for testing
- `POST /api/test/set-random-description/:campaignId` - Set random description for testing

## 🤖 AI Integration

The backend uses Google Gemini AI for:
- Generating campaign message suggestions
- Creating dashboard insights
- Analyzing campaign performance

To enable AI features:
1. Get a Gemini API key
2. Add it to your `.env` file
3. Restart the server

## 🧪 Testing

Run the test suite:
```bash
npm test
```

## 📦 Project Structure

```
backend/
├── config/         # Configuration files
├── controllers/    # Route controllers
├── middleware/     # Custom middleware
├── models/         # Mongoose models
├── routes/         # API routes
├── services/       # Business logic
├── utils/          # Helper functions
└── tests/          # Test files
```

## 🔒 Security

- JWT-based authentication
- Input validation
- Rate limiting
- Secure headers
- Environment variable protection

## 🚀 Deployment

1. Set up MongoDB instance
2. Configure environment variables
3. Build and deploy:
   ```bash
   npm run build
   ```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📝 License

MIT License - feel free to use this project for your own purposes!

---

> **Ready to power your CRM with a robust backend? Start exploring the API endpoints!** 
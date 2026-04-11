require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const logger = require('./utils/logger');
const fineService = require('./services/fineService');

const { errorHandler } = require('./middlewares/errorHandler');

// Route imports
const authRoutes = require('./routes/auth');
const bookRoutes = require('./routes/books');
const circulationRoutes = require('./routes/circulation');
const fineRoutes = require('./routes/fines');
const reservationRoutes = require('./routes/reservations');
const ragRoutes = require('./routes/rag');
const adminRoutes = require('./routes/admin');
const transactionRoutes = require('./routes/transactions');
const donationRoutes = require('./routes/donations');
const suggestionRoutes = require('./routes/suggestions');
const inventoryRoutes = require('./routes/inventory');
const reportRoutes = require('./routes/reports');
const userRoutes = require('./routes/users');
const reviewRoutes = require('./routes/reviews');

const app = express();
const PORT = process.env.PORT || 3000;

// --------------- Global Middleware ---------------
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate Limiting
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 200, 
    message: { success: false, message: 'Too many requests, try again later.' }
});
app.use('/api', globalLimiter);

// Request Logging Middleware
app.use((req, res, next) => {
    logger.info(`Incoming ${req.method} request to ${req.originalUrl}`);
    next();
});

// --------------- Health Check ---------------
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --------------- API Routes ---------------
app.use('/api/auth', authRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/circulation', circulationRoutes);
app.use('/api/fines', fineRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/rag', ragRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api/suggestions', suggestionRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reviews', reviewRoutes);

// --------------- Error Handler (must be last) ---------------
app.use(errorHandler);

// --------------- Background Tasks ---------------
let isProcessingFines = false;
setInterval(async () => {
    if (isProcessingFines) return;
    isProcessingFines = true;
    try {
        await fineService.processRapidFines();
    } catch (err) {
        logger.error(`Error processing rapid fines: ${err.message}`);
    } finally {
        isProcessingFines = false;
    }
}, 10000);

// --------------- Start Server ---------------
app.listen(PORT, '0.0.0.0', () => {
  logger.info(`🚀 OpenShelf backend running on port ${PORT}`);
});

module.exports = app;

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const { errorHandler } = require('./middlewares/errorHandler');

// Route imports
const authRoutes = require('./routes/auth');
const bookRoutes = require('./routes/books');
const circulationRoutes = require('./routes/circulation');
const fineRoutes = require('./routes/fines');
const reservationRoutes = require('./routes/reservations');
const ragRoutes = require('./routes/rag');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

// --------------- Global Middleware ---------------
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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

// --------------- Error Handler (must be last) ---------------
app.use(errorHandler);

// --------------- Start Server ---------------
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 OpenShelf backend running on port ${PORT}`);
});

module.exports = app;

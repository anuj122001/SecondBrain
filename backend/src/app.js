const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth.routes');
const documentRoutes = require('./routes/document.routes');
const chatRoutes = require('./routes/chat.routes');

const app = express();

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/chat', chatRoutes);
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Second Brain API is running' });
});

module.exports = app;

// src/index.js — ProcureAI KZ Express Server
'use strict';

require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const morgan     = require('morgan');
const rateLimit  = require('express-rate-limit');

const authRoutes        = require('./routes/auth');
const dashboardRoutes   = require('./routes/dashboard');
const lotsRoutes        = require('./routes/lots');
const analyzeRoutes     = require('./routes/analyze');
const calculatorRoutes  = require('./routes/calculator');
const { errorHandler }  = require('./middleware/errorHandler');
const { authenticate }  = require('./middleware/auth');

const app  = express();
const PORT = process.env.PORT || 4000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));

// CORS — allow frontend origin
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'http://localhost:3000',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Global rate limiter (100 req / 15 min per IP)
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
}));

// ── Routes ────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({
  status: 'ok',
  service: 'ProcureAI KZ API',
  version: '1.0.0',
  timestamp: new Date().toISOString(),
}));

app.use('/api/auth',       authRoutes);
app.use('/api/dashboard',  authenticate, dashboardRoutes);
app.use('/api/lots',       authenticate, lotsRoutes);
app.use('/api/analyze',    authenticate, analyzeRoutes);
app.use('/api/calculator', authenticate, calculatorRoutes);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

// ── Error handler ─────────────────────────────────────────────────────────────
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 ProcureAI API running on http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Env: ${process.env.NODE_ENV || 'development'}\n`);
});

module.exports = app;

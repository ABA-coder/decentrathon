// src/routes/auth.js
'use strict';

const express  = require('express');
const bcrypt   = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { signToken, authenticate } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login',
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      }

      const { email, password } = req.body;
      const user = await prisma.user.findUnique({ where: { email } });

      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const token = signToken({ id: user.id, email: user.email, role: user.role });

      res.json({
        token,
        user: {
          id:           user.id,
          email:        user.email,
          name:         user.name,
          role:         user.role,
          organization: user.organization,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ── POST /api/auth/register ───────────────────────────────────────────────────
router.post('/register',
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('name').trim().isLength({ min: 2 }),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      }

      const { email, password, name, organization } = req.body;

      const exists = await prisma.user.findUnique({ where: { email } });
      if (exists) {
        return res.status(409).json({ error: 'Email already registered' });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const user = await prisma.user.create({
        data: { email, passwordHash, name, organization, role: 'AUDITOR' },
      });

      const token = signToken({ id: user.id, email: user.email, role: user.role });

      res.status(201).json({
        token,
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, name: true, role: true, organization: true, createdAt: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

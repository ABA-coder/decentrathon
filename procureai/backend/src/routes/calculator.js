// src/routes/calculator.js
// POST /api/calculator/compute  — calculate margin (stateless)
// POST /api/calculator/save     — save calculation to DB
// GET  /api/calculator          — list user's saved calculations
// DELETE /api/calculator/:id    — delete a saved calculation
'use strict';

const express = require('express');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { computeMargin } = require('../utils/taxCalculator');

const router = express.Router();
const prisma = new PrismaClient();

// ── POST /api/calculator/compute ─────────────────────────────────────────────
router.post('/compute',
  body('priceSmeta').isFloat({ gt: 0 }),
  body('pricePurchase').isFloat({ gt: 0 }),
  body('quantity').isInt({ min: 1 }),
  body('taxRegime').isIn(['SIMPLIFIED', 'VAT']),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const result = computeMargin(req.body);
    res.json(result);
  }
);

// ── POST /api/calculator/save ─────────────────────────────────────────────────
router.post('/save',
  body('priceSmeta').isFloat({ gt: 0 }),
  body('pricePurchase').isFloat({ gt: 0 }),
  body('quantity').isInt({ min: 1 }),
  body('taxRegime').isIn(['SIMPLIFIED', 'VAT']),
  body('note').optional().isString().trim(),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      }

      const { priceSmeta, pricePurchase, quantity, taxRegime, note } = req.body;
      const margin = computeMargin({ priceSmeta, pricePurchase, quantity, taxRegime });

      const saved = await prisma.savedCalculation.create({
        data: {
          userId:       req.user.id,
          priceSmeta,
          pricePurchase,
          quantity,
          taxRegime,
          grossProfit:  margin.grossProfit,
          taxAmount:    margin.taxAmount,
          netProfit:    margin.netProfit,
          marginPct:    margin.marginPct,
          note:         note || null,
        },
      });

      res.status(201).json({ ...saved, ...margin });
    } catch (err) {
      next(err);
    }
  }
);

// ── GET /api/calculator ───────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const calcs = await prisma.savedCalculation.findMany({
      where:   { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take:    20,
    });
    res.json(calcs);
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/calculator/:id ────────────────────────────────────────────────
router.delete('/:id', async (req, res, next) => {
  try {
    const calc = await prisma.savedCalculation.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!calc) return res.status(404).json({ error: 'Calculation not found' });

    await prisma.savedCalculation.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

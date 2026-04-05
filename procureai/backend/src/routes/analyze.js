// src/routes/analyze.js
// POST /api/analyze — run risk analysis on a lot
'use strict';

const express = require('express');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { scoreRules, buildGptExplanation } = require('../utils/scoring');

const router = express.Router();
const prisma = new PrismaClient();

// ── POST /api/analyze ────────────────────────────────────────────────────────
router.post('/',
  body('lotId').optional().isUUID(),
  body('title').notEmpty().trim(),
  body('customerOrg').notEmpty().trim(),
  body('initialPriceKzt').isFloat({ gt: 0 }),
  body('bidCount').isInt({ min: 1 }),
  body('submissionDays').isInt({ min: 1 }),
  body('priceMarkupPct').optional().isFloat(),
  body('lotCount').optional().isInt({ min: 1 }),
  body('repeatWinner').optional().isBoolean(),
  body('specTailored').optional().isBoolean(),
  body('contractDurationDays').optional().isInt({ min: 1 }),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      }

      const input = {
        title:               req.body.title,
        category:            req.body.category             || 'Other',
        customerOrg:         req.body.customerOrg,
        region:              req.body.region               || 'Astana',
        initialPriceKzt:     req.body.initialPriceKzt,
        bidCount:            req.body.bidCount,
        submissionDays:      req.body.submissionDays,
        priceMarkupPct:      req.body.priceMarkupPct       ?? 0,
        lotCount:            req.body.lotCount             ?? 1,
        repeatWinner:        req.body.repeatWinner         ?? false,
        specTailored:        req.body.specTailored         ?? false,
        contractDurationDays: req.body.contractDurationDays ?? 180,
        winnerName:          req.body.winnerName           || 'Unknown',
      };

      // ── Score ──────────────────────────────────────────────────────────────
      const scoring = scoreRules(input);
      const gptExplanation = buildGptExplanation(input, scoring);

      // ── Persist if lotId provided ──────────────────────────────────────────
      let lot = null;
      let analysisResult = null;

      if (req.body.lotId) {
        lot = await prisma.lot.findUnique({ where: { id: req.body.lotId } });
        if (!lot) return res.status(404).json({ error: 'Lot not found' });

        // Upsert analysis result
        analysisResult = await prisma.analysisResult.upsert({
          where: { lotId: lot.id },
          update: {
            riskScore:      scoring.riskScore,
            riskLevel:      scoring.riskLevel,
            ruleScore:      scoring.ruleScore,
            mlScore:        scoring.mlScore,
            mlAnomaly:      scoring.mlAnomaly,
            flagsCount:     scoring.triggered.length,
            triggeredRules: scoring.triggered,
            featureContribs: scoring.featureContribs,
            gptExplanation,
            analyzedById:   req.user.id,
            analyzedAt:     new Date(),
          },
          create: {
            lotId:          lot.id,
            riskScore:      scoring.riskScore,
            riskLevel:      scoring.riskLevel,
            ruleScore:      scoring.ruleScore,
            mlScore:        scoring.mlScore,
            mlAnomaly:      scoring.mlAnomaly,
            flagsCount:     scoring.triggered.length,
            triggeredRules: scoring.triggered,
            featureContribs: scoring.featureContribs,
            gptExplanation,
            analyzedById:   req.user.id,
          },
        });
      }

      // ── Response ───────────────────────────────────────────────────────────
      res.json({
        lotId:          lot?.id       || null,
        lotNumber:      lot?.lotNumber || 'MANUAL',
        title:          input.title,
        customerOrg:    input.customerOrg,
        riskScore:      scoring.riskScore,
        riskLevel:      scoring.riskLevel,
        ruleScore:      scoring.ruleScore,
        mlScore:        scoring.mlScore,
        mlAnomaly:      scoring.mlAnomaly,
        flagsCount:     scoring.triggered.length,
        triggeredRules: scoring.triggered,
        featureContribs: scoring.featureContribs,
        gptExplanation,
        disclaimer:     '⚠ This analysis is a decision-support tool. Final conclusions must be made by an authorized auditor.',
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;

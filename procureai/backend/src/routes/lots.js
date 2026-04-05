// src/routes/lots.js
// GET  /api/lots         — paginated list with filters
// GET  /api/lots/:id     — lot detail + analysis result
// PATCH /api/lots/:id    — update status / auditor comment
'use strict';

const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

const VALID_STATUSES = ['NEW', 'IN_REVIEW', 'ARCHIVED'];

// ── GET /api/lots ─────────────────────────────────────────────────────────────
router.get('/',
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('pageSize').optional().isInt({ min: 5, max: 100 }).toInt(),
  query('riskLevel').optional().isIn(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', '']),
  query('region').optional().isString(),
  query('category').optional().isString(),
  query('status').optional().isIn([...VALID_STATUSES, '']),
  query('minScore').optional().isFloat({ min: 0, max: 100 }).toFloat(),
  query('search').optional().isString().trim(),
  async (req, res, next) => {
    try {
      const page     = req.query.page     || 1;
      const pageSize = req.query.pageSize || 20;
      const skip     = (page - 1) * pageSize;

      // Build Prisma WHERE for lots
      const lotWhere = {};
      if (req.query.region)   lotWhere.region   = { contains: req.query.region,   mode: 'insensitive' };
      if (req.query.category) lotWhere.category = { contains: req.query.category, mode: 'insensitive' };
      if (req.query.status)   lotWhere.status   = req.query.status;
      if (req.query.search) {
        const s = req.query.search;
        lotWhere.OR = [
          { lotNumber:   { contains: s, mode: 'insensitive' } },
          { title:       { contains: s, mode: 'insensitive' } },
          { customerOrg: { contains: s, mode: 'insensitive' } },
        ];
      }

      // Build filter on analysisResult
      const arWhere = {};
      if (req.query.riskLevel) arWhere.riskLevel = req.query.riskLevel;
      if (req.query.minScore)  arWhere.riskScore = { gte: req.query.minScore };

      const hasArFilter = Object.keys(arWhere).length > 0;

      // We query through AnalysisResult when filtering by risk
      let total, items;

      if (hasArFilter) {
        [total, items] = await Promise.all([
          prisma.analysisResult.count({
            where: { ...arWhere, lot: lotWhere },
          }),
          prisma.analysisResult.findMany({
            where: { ...arWhere, lot: lotWhere },
            orderBy: { riskScore: 'desc' },
            skip,
            take: pageSize,
            include: {
              lot: {
                select: {
                  id: true, lotNumber: true, title: true, customerOrg: true,
                  region: true, category: true, initialPriceKzt: true,
                  bidCount: true, status: true, publishedDate: true,
                },
              },
            },
          }),
        ]);

        items = items.map(ar => ({
          id:              ar.lot.id,
          lotNumber:       ar.lot.lotNumber,
          title:           ar.lot.title,
          customerOrg:     ar.lot.customerOrg,
          region:          ar.lot.region,
          category:        ar.lot.category,
          initialPriceKzt: ar.lot.initialPriceKzt,
          bidCount:        ar.lot.bidCount,
          status:          ar.lot.status,
          publishedDate:   ar.lot.publishedDate,
          riskScore:       ar.riskScore,
          riskLevel:       ar.riskLevel,
          flagsCount:      ar.flagsCount,
          mlAnomaly:       ar.mlAnomaly,
        }));
      } else {
        [total, items] = await Promise.all([
          prisma.lot.count({ where: lotWhere }),
          prisma.lot.findMany({
            where: lotWhere,
            orderBy: { updatedAt: 'desc' },
            skip,
            take: pageSize,
            select: {
              id: true, lotNumber: true, title: true, customerOrg: true,
              region: true, category: true, initialPriceKzt: true,
              bidCount: true, status: true, publishedDate: true,
              analysisResult: {
                select: { riskScore: true, riskLevel: true, flagsCount: true, mlAnomaly: true },
              },
            },
          }),
        ]);

        items = items.map(l => ({
          id:              l.id,
          lotNumber:       l.lotNumber,
          title:           l.title,
          customerOrg:     l.customerOrg,
          region:          l.region,
          category:        l.category,
          initialPriceKzt: l.initialPriceKzt,
          bidCount:        l.bidCount,
          status:          l.status,
          publishedDate:   l.publishedDate,
          riskScore:       l.analysisResult?.riskScore  ?? null,
          riskLevel:       l.analysisResult?.riskLevel  ?? null,
          flagsCount:      l.analysisResult?.flagsCount ?? 0,
          mlAnomaly:       l.analysisResult?.mlAnomaly  ?? false,
        }));
      }

      res.json({
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
        items,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ── GET /api/lots/:id ─────────────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const lot = await prisma.lot.findUnique({
      where: { id: req.params.id },
      include: {
        analysisResult: true,
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!lot) return res.status(404).json({ error: 'Lot not found' });
    res.json(lot);
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/lots/:id ───────────────────────────────────────────────────────
router.patch('/:id',
  body('status').optional().isIn(VALID_STATUSES),
  body('auditorComment').optional().isString().trim(),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      }

      const { status, auditorComment } = req.body;
      const data = {};
      if (status !== undefined)         data.status         = status;
      if (auditorComment !== undefined) data.auditorComment = auditorComment;

      if (Object.keys(data).length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      const lot = await prisma.lot.update({
        where: { id: req.params.id },
        data,
      });

      res.json(lot);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;

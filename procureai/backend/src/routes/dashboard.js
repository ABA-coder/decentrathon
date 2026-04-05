// src/routes/dashboard.js
// GET /api/dashboard — summary KPIs and top-risk lots
'use strict';

const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

router.get('/', async (req, res, next) => {
  try {
    // Parallel queries for performance
    const [
      totalLots,
      riskCounts,
      totalValue,
      anomalyCount,
      topRiskLots,
      categoryBreakdown,
      regionBreakdown,
    ] = await Promise.all([
      // Total
      prisma.lot.count(),

      // Count by risk level
      prisma.analysisResult.groupBy({
        by: ['riskLevel'],
        _count: { id: true },
      }),

      // Sum of all lot values
      prisma.lot.aggregate({ _sum: { initialPriceKzt: true } }),

      // ML anomaly count
      prisma.analysisResult.count({ where: { mlAnomaly: true } }),

      // Top 10 highest-risk lots for the dashboard table
      prisma.analysisResult.findMany({
        orderBy: { riskScore: 'desc' },
        take: 10,
        include: {
          lot: {
            select: {
              id: true, lotNumber: true, title: true, customerOrg: true,
              region: true, category: true, initialPriceKzt: true, bidCount: true, status: true,
            },
          },
        },
      }),

      // Category breakdown for flagged lots
      prisma.$queryRaw`
        SELECT l.category, COUNT(*)::int AS count
        FROM analysis_results ar
        JOIN lots l ON l.id = ar.lot_id
        WHERE ar.risk_level IN ('CRITICAL', 'HIGH')
        GROUP BY l.category
        ORDER BY count DESC
        LIMIT 6
      `,

      // Region breakdown
      prisma.$queryRaw`
        SELECT l.region, COUNT(*)::int AS count
        FROM analysis_results ar
        JOIN lots l ON l.id = ar.lot_id
        WHERE ar.risk_level IN ('CRITICAL', 'HIGH')
        GROUP BY l.region
        ORDER BY count DESC
        LIMIT 6
      `,
    ]);

    // Build level map
    const levelMap = Object.fromEntries(
      riskCounts.map(r => [r.riskLevel, r._count.id])
    );

    // Impact: budget at risk (critical lots only)
    const criticalValueResult = await prisma.$queryRaw`
      SELECT COALESCE(SUM(l.initial_price_kzt), 0) AS total
      FROM analysis_results ar
      JOIN lots l ON l.id = ar.lot_id
      WHERE ar.risk_level = 'CRITICAL'
    `;
    const budgetAtRisk     = Number(criticalValueResult[0]?.total || 0);
    const potentialSavings = budgetAtRisk * 0.15;

    res.json({
      kpis: {
        totalLots,
        criticalCount:    levelMap['CRITICAL']  || 0,
        highCount:        levelMap['HIGH']       || 0,
        mediumCount:      levelMap['MEDIUM']     || 0,
        lowCount:         levelMap['LOW']        || 0,
        totalValueKzt:    totalValue._sum.initialPriceKzt || 0,
        anomalyRatePct:   totalLots > 0 ? Math.round(anomalyCount / totalLots * 1000) / 10 : 0,
        budgetAtRiskKzt:  budgetAtRisk,
        potentialSavingsKzt: potentialSavings,
      },
      topRiskLots: topRiskLots.map(ar => ({
        id:             ar.lot.id,
        lotNumber:      ar.lot.lotNumber,
        title:          ar.lot.title,
        customerOrg:    ar.lot.customerOrg,
        region:         ar.lot.region,
        category:       ar.lot.category,
        initialPriceKzt: ar.lot.initialPriceKzt,
        bidCount:       ar.lot.bidCount,
        status:         ar.lot.status,
        riskScore:      ar.riskScore,
        riskLevel:      ar.riskLevel,
        flagsCount:     ar.flagsCount,
        mlAnomaly:      ar.mlAnomaly,
      })),
      categoryBreakdown,
      regionBreakdown,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

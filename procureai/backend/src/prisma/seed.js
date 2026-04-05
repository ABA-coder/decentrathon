// prisma/seed.js — Seed demo lots + admin user
'use strict';

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { v4: uuid } = require('uuid');

const prisma = new PrismaClient();

// ── Seed data ────────────────────────────────────────────────────────────────
const CATEGORIES = [
  'Construction Works', 'IT Services & Software', 'Medical Equipment',
  'Food Supplies', 'Office Supplies', 'Transportation Services',
  'Consulting Services', 'Security Services', 'Road Repair', 'Pharmaceuticals',
];
const ORGS = [
  'Ministry of Health RK', 'Ministry of Education RK', 'Almaty City Akimat',
  'Astana City Akimat', 'Karaganda Region Akimat', 'Ministry of Internal Affairs RK',
  'KazAutoRoad', 'KazMunaiGaz', 'Samruk-Kazyna', 'KTZ Railways',
];
const REGIONS = [
  'Astana', 'Almaty', 'Shymkent', 'Aktobe', 'Taraz',
  'Pavlodar', 'Ust-Kamenogorsk', 'Semey', 'Atyrau', 'Kyzylorda',
];
const WINNERS = [
  'AltynStroy LLC', 'KazTechService LLC', 'NurSnab LLC', 'BerekeGroup LLC',
  'MegaStroy KZ LLC', 'AkzholConsult LLC', 'DigitalKZ LLC', 'StepSnab LLC',
];

function rng(seed) {
  let s = seed;
  return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
}

function pick(arr, r) { return arr[Math.floor(r() * arr.length)]; }

function generateLots(n = 60, seed = 42) {
  const r = rng(seed);
  const lots = [];
  for (let i = 0; i < n; i++) {
    const injectA1 = r() < 0.22;
    const injectA2 = r() < 0.18;
    const injectA3 = r() < 0.20;
    const injectA4 = r() < 0.15;
    const injectA5 = r() < 0.12;
    const injectA6 = r() < 0.14;

    const bidCount       = injectA1 ? 1 : injectA5 ? Math.ceil(r() * 2) : 2 + Math.floor(r() * 10);
    const priceMarkupPct = injectA2 ? 35 + r() * 145 : -10 + r() * 30;
    const submissionDays = injectA3 ? 1 + Math.floor(r() * 4) : 10 + Math.floor(r() * 35);
    const lotCount       = injectA5 ? 8 + Math.floor(r() * 18) : 1 + Math.floor(r() * 4);
    const basePrice      = Math.exp(15.5 + (r() - 0.5) * 3.2);

    lots.push({
      lotNumber:            `KZ-2024-${String(i + 1).padStart(5, '0')}`,
      title:                `${pick(CATEGORIES, r)}: services (${pick(REGIONS, r)})`,
      category:             pick(CATEGORIES, r),
      customerOrg:          pick(ORGS, r),
      region:               pick(REGIONS, r),
      publishedDate:        new Date(Date.now() - Math.floor(r() * 365 * 86400000)),
      winnerName:           pick(WINNERS, r),
      initialPriceKzt:      Math.round(basePrice * (1 + priceMarkupPct / 100)),
      bidCount:             Math.max(1, bidCount),
      submissionDays:       Math.max(1, submissionDays),
      repeatWinner:         injectA4,
      lotCount:             Math.max(1, lotCount),
      specTailored:         injectA6,
      contractDurationDays: 30 + Math.floor(r() * 700),
      priceMarkupPct:       Math.round(priceMarkupPct * 10) / 10,
      status:               'NEW',
    });
  }
  return lots;
}

// ── Risk scoring (mirrors Python logic) ──────────────────────────────────────
function scoreRules(lot) {
  const rules = [
    { id: 'R1', code: 'A1', label: 'Single bid',         weight: 20, fired: lot.bidCount === 1 },
    { id: 'R2', code: 'A2', label: 'Price inflation',    weight: 25, fired: lot.priceMarkupPct > 30 },
    { id: 'R3', code: 'A3', label: 'Tight deadline',     weight: 18, fired: lot.submissionDays < 5 },
    { id: 'R4', code: 'A4', label: 'Repeat winner',      weight: 22, fired: lot.repeatWinner },
    { id: 'R5', code: 'A5', label: 'Lot splitting',      weight: 15, fired: lot.lotCount >= 8 },
    { id: 'R6', code: 'A6', label: 'Tailored spec',      weight: 20, fired: lot.specTailored },
  ];
  const triggered = rules.filter(r => r.fired);
  const wSum = triggered.reduce((s, r) => s + r.weight, 0);
  const ruleScore = Math.min(100, (wSum / 120) * 100 * 1.6);
  const mlScore   = triggered.length >= 3 ? 55 + Math.random() * 30 : Math.random() * 40;
  const riskScore = Math.round((0.55 * ruleScore + 0.45 * mlScore) * 10) / 10;
  const riskLevel = riskScore >= 70 ? 'CRITICAL' : riskScore >= 45 ? 'HIGH' : riskScore >= 20 ? 'MEDIUM' : 'LOW';
  return { riskScore, riskLevel, ruleScore: Math.round(ruleScore * 10) / 10, mlScore: Math.round(mlScore * 10) / 10, triggered };
}

async function main() {
  console.log('🌱 Seeding database...');

  // Admin user
  const passwordHash = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@procureai.kz' },
    update: {},
    create: {
      email: 'admin@procureai.kz',
      passwordHash,
      name: 'Admin User',
      role: 'ADMIN',
      organization: 'ProcureAI KZ',
    },
  });

  // Demo auditor
  const auditorHash = await bcrypt.hash('auditor123', 10);
  const auditor = await prisma.user.upsert({
    where: { email: 'auditor@kkson.kz' },
    update: {},
    create: {
      email: 'auditor@kkson.kz',
      passwordHash: auditorHash,
      name: 'Audit Officer',
      role: 'AUDITOR',
      organization: 'Committee for Quality Control in Education',
    },
  });

  console.log('✓ Users created');

  // Lots + Analysis results
  const lotsData = generateLots(60);
  let created = 0;

  for (const lotData of lotsData) {
    const existing = await prisma.lot.findUnique({ where: { lotNumber: lotData.lotNumber } });
    if (existing) continue;

    const lot = await prisma.lot.create({
      data: { ...lotData, createdById: admin.id },
    });

    const { riskScore, riskLevel, ruleScore, mlScore, triggered } = scoreRules(lot);
    const mlAnomaly = riskLevel === 'CRITICAL' || riskLevel === 'HIGH';

    const gptExplanation = triggered.length > 0 ? {
      verdictSummary:    `Lot shows ${triggered.length}/6 anomaly indicators. Risk score: ${riskScore}/100 (${riskLevel}).`,
      riskRationale:     `Rule Engine triggered ${triggered.length} rules (total weight ${triggered.reduce((s, r) => s + r.weight, 0)}/120). ML model ${mlAnomaly ? 'confirmed' : 'did not detect'} anomaly pattern.`,
      flagAnalysis:      triggered.map(r => ({ code: r.code, explanation: `${r.label} flag triggered` })),
      recommendedActions: [
        'Request price justification from contracting authority',
        'Verify winner affiliation with contracting officials',
        'Review 12-month tender history for this organization',
      ],
      dataGaps:   'Market price registry, beneficial ownership register',
      disclaimer: 'This analysis is a decision-support tool only. Final conclusions must be made by an authorized auditor.',
    } : null;

    await prisma.analysisResult.create({
      data: {
        lotId:          lot.id,
        riskScore,
        riskLevel,
        ruleScore,
        mlScore,
        mlAnomaly,
        flagsCount:     triggered.length,
        triggeredRules: triggered.map(r => ({ ruleId: r.id, code: r.code, label: r.label, weight: r.weight })),
        featureContribs: [
          { feature: 'bid_count',       label: 'Bid Count',       zScore: lot.bidCount === 1 ? 2.8 : -0.3 },
          { feature: 'price_markup_pct',label: 'Price Markup',    zScore: Math.round((lot.priceMarkupPct - 15) / 20 * 100) / 100 },
          { feature: 'submission_days', label: 'Submission Days', zScore: lot.submissionDays < 5 ? -2.5 : 0.4 },
          { feature: 'repeat_winner',   label: 'Repeat Winner',   zScore: lot.repeatWinner ? 1.9 : -0.2 },
          { feature: 'lot_count',       label: 'Lot Count',       zScore: Math.round((lot.lotCount - 3) / 2 * 100) / 100 },
          { feature: 'spec_tailored',   label: 'Tailored Spec',   zScore: lot.specTailored ? 2.1 : -0.1 },
        ],
        gptExplanation,
        analyzedById: admin.id,
      },
    });

    created++;
  }

  console.log(`✓ ${created} lots + analysis results created`);
  console.log('\n📋 Demo credentials:');
  console.log('   Admin:   admin@procureai.kz   / admin123');
  console.log('   Auditor: auditor@kkson.kz     / auditor123');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

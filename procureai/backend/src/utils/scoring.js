// src/utils/scoring.js
// Rule-based + mock ML risk scoring (mirrors Python detector.py logic)
'use strict';

const RULES = [
  {
    id: 'R1', code: 'A1',
    label: 'Single bid',
    description: 'Only one bid submitted — possible affiliation or competition restriction',
    weight: 20,
    check: l => l.bidCount === 1,
  },
  {
    id: 'R2', code: 'A2',
    label: 'Price inflation',
    description: 'Initial price exceeds market reference by more than 30%',
    weight: 25,
    check: l => (l.priceMarkupPct ?? 0) > 30,
  },
  {
    id: 'R3', code: 'A3',
    label: 'Tight deadline',
    description: 'Submission window under 5 working days — limits participant access',
    weight: 18,
    check: l => l.submissionDays < 5,
  },
  {
    id: 'R4', code: 'A4',
    label: 'Repeat winner',
    description: 'Same supplier wins repeatedly from this customer without competition',
    weight: 22,
    check: l => !!l.repeatWinner,
  },
  {
    id: 'R5', code: 'A5',
    label: 'Lot splitting',
    description: 'Unusually high lot count — indicator of contract splitting to bypass thresholds',
    weight: 15,
    check: l => (l.lotCount ?? 1) >= 8,
  },
  {
    id: 'R6', code: 'A6',
    label: 'Tailored specification',
    description: 'Technical requirements appear written for a specific supplier',
    weight: 20,
    check: l => !!l.specTailored,
  },
];

const TOTAL_RULE_WEIGHT = RULES.reduce((s, r) => s + r.weight, 0); // 120

/**
 * Score a lot using rules + mock ML.
 * Risk = 0.55 × ruleScore + 0.45 × mlScore
 */
function scoreRules(lot) {
  const triggered = RULES
    .filter(r => r.check(lot))
    .map(r => ({ ruleId: r.id, code: r.code, label: r.label, description: r.description, weight: r.weight }));

  const wSum      = triggered.reduce((s, r) => s + r.weight, 0);
  const ruleScore = Math.min(100, (wSum / TOTAL_RULE_WEIGHT) * 100 * 1.6);

  // Deterministic ML-like score based on triggered count + price deviation
  const mlBase   = triggered.length >= 3 ? 55 + triggered.length * 4 : triggered.length * 10;
  const mlNoise  = ((lot.initialPriceKzt || 1e6) % 10) / 10 * 5; // deterministic pseudo-noise
  const mlScore  = Math.min(100, mlBase + mlNoise);

  const riskScore  = Math.round((0.55 * ruleScore + 0.45 * mlScore) * 10) / 10;
  const riskLevel  = riskScore >= 70 ? 'CRITICAL' : riskScore >= 45 ? 'HIGH' : riskScore >= 20 ? 'MEDIUM' : 'LOW';
  const mlAnomaly  = mlLabel(triggered.length, mlScore);

  const featureContribs = buildFeatureContribs(lot);

  return {
    riskScore,
    riskLevel,
    ruleScore:    Math.round(ruleScore * 10) / 10,
    mlScore:      Math.round(mlScore   * 10) / 10,
    mlAnomaly,
    triggered,
    featureContribs,
  };
}

function mlLabel(flagCount, mlScore) {
  return flagCount >= 2 || mlScore >= 50;
}

function buildFeatureContribs(lot) {
  return [
    { feature: 'bid_count',        label: 'Bid Count',        zScore: lot.bidCount === 1 ? 2.8 : -0.3 },
    { feature: 'price_markup_pct', label: 'Price Markup %',   zScore: Math.round(((lot.priceMarkupPct || 0) - 15) / 20 * 100) / 100 },
    { feature: 'submission_days',  label: 'Submission Days',  zScore: lot.submissionDays < 5 ? -2.5 : 0.4 },
    { feature: 'repeat_winner',    label: 'Repeat Winner',    zScore: lot.repeatWinner ? 1.9 : -0.2 },
    { feature: 'lot_count',        label: 'Lot Count',        zScore: Math.round(((lot.lotCount || 1) - 3) / 2 * 100) / 100 },
    { feature: 'spec_tailored',    label: 'Tailored Spec',    zScore: lot.specTailored ? 2.1 : -0.1 },
    { feature: 'initial_price_kzt',label: 'Initial Price',    zScore: Math.round(Math.log10(Math.max(1, lot.initialPriceKzt || 1)) / 8 * 100) / 100 },
  ].sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));
}

/**
 * Build GPT-style structured explanation (without calling OpenAI).
 * Swap this for a real OpenAI call when deploying with an API key.
 */
function buildGptExplanation(lot, scoring) {
  const { triggered, riskScore, riskLevel, mlAnomaly } = scoring;
  if (triggered.length === 0) return null;

  return {
    verdictSummary: `Lot shows ${triggered.length}/6 anomaly indicators. Risk score ${riskScore}/100 (${riskLevel}).`,
    riskRationale:  `Rule Engine triggered ${triggered.length} rules (combined weight ${triggered.reduce((s, r) => s + r.weight, 0)}/120). ML model ${mlAnomaly ? 'confirmed' : 'did not confirm'} anomaly classification.`,
    flagAnalysis:   triggered.map(r => ({ code: r.code, explanation: r.description })),
    recommendedActions: [
      'Request price justification from the contracting authority',
      'Verify winner affiliation with contracting officials',
      'Review 12-month tender history for this organization',
      triggered.some(r => r.code === 'A6') ? 'Check technical specification for supplier-specific requirements' : null,
    ].filter(Boolean),
    dataGaps:   'Market price register, beneficial ownership registry',
    disclaimer: '⚠ This analysis is a decision-support tool only. Final determination must be made by an authorized auditor.',
  };
}

module.exports = { scoreRules, buildFeatureContribs, buildGptExplanation, RULES };

// src/utils/taxCalculator.js
// Core margin/tax calculation logic — extracted from frontend script tag
'use strict';

const TAX_RATES = {
  SIMPLIFIED: 0.03,   // Simplified tax declaration (3%)
  VAT:        0.12,   // Value Added Tax (12%)
};

const TAX_LABELS = {
  SIMPLIFIED: 'Simplified Declaration (3%)',
  VAT:        'VAT (12%)',
};

/**
 * Compute gross profit, tax, net profit and margin percentage.
 *
 * Formula:
 *   grossProfit = (priceSmeta - pricePurchase) × quantity
 *   taxAmount   = max(0, grossProfit) × taxRate
 *   netProfit   = grossProfit − taxAmount
 *   marginPct   = netProfit / (priceSmeta × quantity) × 100
 *
 * @param {object} params
 * @param {number} params.priceSmeta    - Contract price per unit (₸)
 * @param {number} params.pricePurchase - Purchase/cost price per unit (₸)
 * @param {number} params.quantity      - Number of units
 * @param {string} params.taxRegime     - 'SIMPLIFIED' | 'VAT'
 * @returns {object} Calculation result
 */
function computeMargin({ priceSmeta, pricePurchase, quantity, taxRegime }) {
  const taxRate    = TAX_RATES[taxRegime] ?? TAX_RATES.SIMPLIFIED;
  const grossProfit = (priceSmeta - pricePurchase) * quantity;
  const taxAmount   = grossProfit > 0 ? grossProfit * taxRate : 0;
  const netProfit   = grossProfit - taxAmount;
  const contractTotal = priceSmeta * quantity;
  const marginPct  = contractTotal > 0 ? (netProfit / contractTotal) * 100 : 0;

  return {
    grossProfit:   Math.round(grossProfit * 100) / 100,
    taxAmount:     Math.round(taxAmount   * 100) / 100,
    netProfit:     Math.round(netProfit   * 100) / 100,
    marginPct:     Math.round(marginPct   * 100) / 100,
    taxRatePct:    taxRate * 100,
    taxRegimeLabel: TAX_LABELS[taxRegime] || 'Unknown',
    contractTotal: Math.round(contractTotal * 100) / 100,
    isLoss:        grossProfit < 0,
  };
}

module.exports = { computeMargin, TAX_RATES, TAX_LABELS };

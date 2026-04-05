// src/lib/format.js — Shared formatting utilities

export function fmtMoney(v) {
  const n = Number(v) || 0;
  if (n >= 1e9) return (n / 1e9).toFixed(2) + ' B ₸';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + ' M ₸';
  if (n >= 1e3) return (n / 1e3).toFixed(0) + ' K ₸';
  return n.toFixed(0) + ' ₸';
}

export function fmtNumber(v) {
  return (Number(v) || 0).toLocaleString('en');
}

export function scoreColor(s) {
  if (s >= 70) return '#f04f43';
  if (s >= 45) return '#e09a2e';
  if (s >= 20) return '#c9b93a';
  return '#27a862';
}

export function riskLevelLabel(level) {
  const map = { CRITICAL: 'Critical', HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low' };
  return map[level] || level;
}

export function statusLabel(s) {
  const map = { NEW: 'New', IN_REVIEW: 'In Review', ARCHIVED: 'Archived' };
  return map[s] || s;
}

export function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

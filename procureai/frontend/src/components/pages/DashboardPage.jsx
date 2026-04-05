// src/components/pages/DashboardPage.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardApi } from '../../lib/api';
import { fmtMoney, fmtNumber, scoreColor, riskLevelLabel } from '../../lib/format';
import { KpiCard, Card, CardHeader, CardBody, RiskBadge, MLBadge, ScoreBar, HBar } from '../ui';

export default function DashboardPage() {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    dashboardApi.get()
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const kpis = data?.kpis || {};
  const topLots = data?.topRiskLots || [];
  const catData = data?.categoryBreakdown || [];
  const regData = data?.regionBreakdown   || [];
  const maxCat = Math.max(...catData.map(c => c.count), 1);
  const maxReg = Math.max(...regData.map(r => r.count), 1);

  return (
    <div>
      {/* ── KPI row ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-5 gap-3 mb-5">
        <KpiCard label="Total Lots"     value={loading ? null : fmtNumber(kpis.totalLots)}       sub="in database" />
        <KpiCard label="Critical Risk"  value={loading ? null : fmtNumber(kpis.criticalCount)}   sub="require review"    accent="red" />
        <KpiCard label="High Risk"      value={loading ? null : fmtNumber(kpis.highCount)}        sub="under watch"       accent="amber" />
        <KpiCard label="ML Anomaly Rate"value={loading ? null : `${kpis.anomalyRatePct ?? 0}%`} sub="Isolation Forest"  accent="yellow" />
        <KpiCard label="Total Volume"   value={loading ? null : fmtMoney(kpis.totalValueKzt)}    sub="initial price" />
      </div>

      {/* ── Impact Dashboard ─────────────────────────────────────────────── */}
      <Card className="mb-5">
        <CardHeader title="Budget Savings Forecast" meta="Impact Dashboard · lots with risk score ≥ 70" />
        <CardBody>
          <div className="grid grid-cols-3 gap-4 mb-3">
            <KpiCard label="Budget at Risk"       value={loading ? null : fmtMoney(kpis.budgetAtRiskKzt)}      sub="critical lots"           accent="red" />
            <KpiCard label="Potential Savings"    value={loading ? null : fmtMoney(kpis.potentialSavingsKzt)} sub="conservative est. ~15%"  accent="green" />
            <KpiCard label="Critical Lots"        value={loading ? null : fmtNumber(kpis.criticalCount)}       sub="need urgent review" />
          </div>
          <p className="text-[10px] text-text-muted font-mono">
            ⚠ Forecast is indicative only. Actual savings depend on audit outcomes.
          </p>
        </CardBody>
      </Card>

      {/* ── Charts row ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <Card>
          <CardHeader title="Risk Distribution" />
          <CardBody>
            {loading ? <div className="skel h-32 w-full" /> : (
              <>
                {[
                  { label: 'Critical', count: kpis.criticalCount, color: '#f04f43' },
                  { label: 'High',     count: kpis.highCount,     color: '#e09a2e' },
                  { label: 'Medium',   count: kpis.mediumCount,   color: '#c9b93a' },
                  { label: 'Low',      count: kpis.lowCount,      color: '#27a862' },
                ].map(d => (
                  <HBar key={d.label} label={d.label} value={d.count} max={kpis.totalLots} color={d.color} />
                ))}
                <p className="text-[10px] text-text-muted mt-2">Distribution of {fmtNumber(kpis.totalLots)} lots by risk level</p>
              </>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Top Categories (Critical + High)" />
          <CardBody>
            {loading ? <div className="skel h-32 w-full" /> : catData.map(c => (
              <HBar key={c.category} label={c.category} value={c.count} max={maxCat} color="#4d8ef5" />
            ))}
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-5">
        <Card>
          <CardHeader title="Top Organizations by Flags" />
          <CardBody className="p-0">
            {loading ? <div className="skel h-24 m-4" /> :
              topLots.slice(0, 6).map((t, i) => (
                <div key={t.id} className="flex items-center gap-3 px-4 py-2 border-b border-[rgba(255,255,255,.05)] last:border-0">
                  <span className="text-[10px] font-mono text-text-muted w-4">{i + 1}</span>
                  <span className="flex-1 text-[12px] text-text-secondary truncate">{t.customerOrg}</span>
                  <RiskBadge level={t.riskLevel} />
                </div>
              ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Region Breakdown (High Risk)" />
          <CardBody>
            {loading ? <div className="skel h-32 w-full" /> : regData.map(r => (
              <HBar key={r.region} label={r.region} value={r.count} max={maxReg} color="#3b7dd8" />
            ))}
          </CardBody>
        </Card>
      </div>

      {/* ── Top risk table ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader title="Highest Risk Lots" meta="Top 10 · sorted by risk score" />
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-[rgba(255,255,255,.07)]">
                {['Lot ID', 'Title', 'Organization', 'Region', 'Price', 'Bids', 'Risk Score', 'Level', 'Flags', 'ML'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-[10px] font-mono text-text-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-text-muted">Loading...</td></tr>
              ) : topLots.map(t => (
                <tr key={t.id}
                  onClick={() => navigate(`/lots?id=${t.id}`)}
                  className="border-b border-[rgba(255,255,255,.04)] hover:bg-bg-raised cursor-pointer transition-colors">
                  <td className="px-3 py-2 font-mono text-[10px] text-text-muted whitespace-nowrap">{t.lotNumber}</td>
                  <td className="px-3 py-2 max-w-[200px] truncate text-text-secondary" title={t.title}>{t.title}</td>
                  <td className="px-3 py-2 max-w-[140px] truncate text-text-muted" title={t.customerOrg}>{t.customerOrg}</td>
                  <td className="px-3 py-2 text-text-muted">{t.region}</td>
                  <td className="px-3 py-2 font-mono whitespace-nowrap">{fmtMoney(t.initialPriceKzt)}</td>
                  <td className="px-3 py-2 font-mono text-center">{t.bidCount}</td>
                  <td className="px-3 py-2 w-32"><ScoreBar score={t.riskScore} level={t.riskLevel} /></td>
                  <td className="px-3 py-2"><RiskBadge level={t.riskLevel} /></td>
                  <td className="px-3 py-2 font-mono text-center">{t.flagsCount}</td>
                  <td className="px-3 py-2"><MLBadge anomaly={t.mlAnomaly} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

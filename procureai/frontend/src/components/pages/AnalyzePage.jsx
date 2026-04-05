// src/components/pages/AnalyzePage.jsx
import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { analyzeApi } from '../../lib/api';
import { fmtMoney, scoreColor, riskLevelLabel } from '../../lib/format';
import { Card, CardHeader, CardBody, RiskBadge, MLBadge, Button, FormField, Input, Select, Spinner } from '../ui';
import { useToast } from '../../context/ToastContext';

const RULES_META = {
  A1: { label: 'Single Bid',          desc: 'Only one bid submitted — possible affiliation or competition restriction', weight: 20 },
  A2: { label: 'Price Inflation',     desc: 'Initial price exceeds market reference by more than 30%',                 weight: 25 },
  A3: { label: 'Tight Deadline',      desc: 'Submission window under 5 working days — limits participant access',      weight: 18 },
  A4: { label: 'Repeat Winner',       desc: 'Same supplier wins repeatedly from this customer',                        weight: 22 },
  A5: { label: 'Lot Splitting',       desc: 'Unusually high lot count — indicator of contract splitting',              weight: 15 },
  A6: { label: 'Tailored Spec',       desc: 'Technical requirements appear written for a specific supplier',           weight: 20 },
};

const PIPELINE_STEPS = [
  { id: 1, label: '01 — Input',      name: 'Lot Parameters' },
  { id: 2, label: '02 — Rule Engine',name: 'Rules A1–A6' },
  { id: 3, label: '03 — ML Model',   name: 'Isolation Forest' },
  { id: 4, label: '04 — Risk Score', name: '0.55×Rule + 0.45×ML' },
  { id: 5, label: '05 — AI Report',  name: 'Auditor Narrative' },
];

const INIT = {
  title: '', customerOrg: '', winnerName: '', category: 'Construction Works',
  region: 'Astana', initialPriceKzt: '', bidCount: '', submissionDays: '',
  priceMarkupPct: '', lotCount: '1', contractDurationDays: '180',
  repeatWinner: false, specTailored: false,
};

export default function AnalyzePage() {
  const location = useLocation();
  const toast    = useToast();

  const [form, setForm]       = useState(INIT);
  const [errors, setErrors]   = useState({});
  const [result, setResult]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [activePipe, setActivePipe] = useState(1);

  // Pre-fill from lot registry navigation
  useEffect(() => {
    const lot = location.state?.lot;
    if (lot) {
      setForm({
        title:               lot.title        || '',
        customerOrg:         lot.customerOrg  || '',
        winnerName:          lot.winnerName   || '',
        category:            lot.category     || 'Construction Works',
        region:              lot.region       || 'Astana',
        initialPriceKzt:     lot.initialPriceKzt  || '',
        bidCount:            lot.bidCount     || '',
        submissionDays:      lot.submissionDays || '',
        priceMarkupPct:      lot.priceMarkupPct ?? '',
        lotCount:            lot.lotCount     || '1',
        contractDurationDays: lot.contractDurationDays || '180',
        repeatWinner:        !!lot.repeatWinner,
        specTailored:        !!lot.specTailored,
      });
      setResult(null);
    }
  }, [location.state]);

  const set = key => e => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm(f => ({ ...f, [key]: val }));
    setErrors(er => ({ ...er, [key]: '' }));
  };

  const validate = () => {
    const errs = {};
    if (!form.title.trim())      errs.title      = 'Required';
    if (!form.customerOrg.trim()) errs.customerOrg = 'Required';
    if (!form.initialPriceKzt || Number(form.initialPriceKzt) <= 0) errs.initialPriceKzt = 'Must be > 0';
    if (!form.bidCount || Number(form.bidCount) < 1)                 errs.bidCount        = 'Must be ≥ 1';
    if (!form.submissionDays || Number(form.submissionDays) < 1)    errs.submissionDays  = 'Must be ≥ 1';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const fillDemo = () => {
    setForm({
      title:               'Construction Works: capital repair of education facilities',
      customerOrg:         'Education Department, Astana',
      winnerName:          'MegaStroy KZ LLC',
      category:            'Construction Works',
      region:              'Astana',
      initialPriceKzt:     '485000000',
      bidCount:            '1',
      submissionDays:      '3',
      priceMarkupPct:      '62.0',
      lotCount:            '12',
      contractDurationDays:'180',
      repeatWinner:        true,
      specTailored:        true,
    });
    setResult(null);
    setErrors({});
  };

  const runAnalysis = async () => {
    if (!validate()) return;
    setLoading(true);
    setResult(null);

    // Animate pipeline steps
    for (let i = 2; i <= 5; i++) {
      setTimeout(() => setActivePipe(i), (i - 2) * 350);
    }

    try {
      const payload = {
        ...form,
        initialPriceKzt:      Number(form.initialPriceKzt),
        bidCount:             Number(form.bidCount),
        submissionDays:       Number(form.submissionDays),
        priceMarkupPct:       Number(form.priceMarkupPct) || 0,
        lotCount:             Number(form.lotCount) || 1,
        contractDurationDays: Number(form.contractDurationDays) || 180,
      };
      const { data } = await analyzeApi.run(payload);
      setResult(data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Analysis failed');
    } finally {
      setLoading(false);
      setActivePipe(1);
    }
  };

  return (
    <div>
      {/* ── Pipeline indicator ───────────────────────────────────────────── */}
      <div className="flex mb-5 bg-bg-surface border border-[rgba(255,255,255,.07)] rounded-lg overflow-hidden">
        {PIPELINE_STEPS.map((step, i) => (
          <div key={step.id}
            className={`flex-1 px-3 py-2.5 border-r border-[rgba(255,255,255,.07)] last:border-r-0 transition-all duration-300
              ${activePipe >= step.id ? 'bg-[rgba(59,125,216,.08)]' : ''}`}>
            <div className={`text-[9px] font-mono uppercase tracking-widest mb-0.5 ${activePipe >= step.id ? 'text-accent' : 'text-text-label'}`}>{step.label}</div>
            <div className={`text-[11px] font-medium ${activePipe >= step.id ? 'text-text-primary' : 'text-text-muted'}`}>{step.name}</div>
          </div>
        ))}
      </div>

      {/* ── Form ─────────────────────────────────────────────────────────── */}
      <Card className="mb-4">
        <CardHeader title="Lot Parameters">
          <Button size="sm" onClick={fillDemo}>Fill Demo</Button>
          <Button size="sm" onClick={() => { setForm(INIT); setResult(null); setErrors({}); }}>Clear</Button>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <FormField label="Lot Title" required error={errors.title} className="col-span-2">
              <Input value={form.title} onChange={set('title')} placeholder="Construction Works: road repair (Astana)" />
            </FormField>
            <FormField label="Contracting Organization" required error={errors.customerOrg}>
              <Input value={form.customerOrg} onChange={set('customerOrg')} placeholder="Ministry of Education RK" />
            </FormField>
            <FormField label="Winner (supplier)">
              <Input value={form.winnerName} onChange={set('winnerName')} placeholder="MegaStroy KZ LLC" />
            </FormField>
            <FormField label="Initial Price (₸)" required error={errors.initialPriceKzt}>
              <Input type="number" value={form.initialPriceKzt} onChange={set('initialPriceKzt')} placeholder="485000000" min="1" />
            </FormField>
            <FormField label="Bid Count" required error={errors.bidCount}>
              <Input type="number" value={form.bidCount} onChange={set('bidCount')} placeholder="1" min="1" />
            </FormField>
            <FormField label="Submission Window (days)" required error={errors.submissionDays} hint="< 5 triggers flag A3">
              <Input type="number" value={form.submissionDays} onChange={set('submissionDays')} placeholder="3" min="1" />
            </FormField>
            <FormField label="Price Markup (%)" hint="> 30% triggers flag A2">
              <Input type="number" value={form.priceMarkupPct} onChange={set('priceMarkupPct')} placeholder="62.0" step="0.1" />
            </FormField>
            <FormField label="Lot Count" hint="≥ 8 triggers flag A5">
              <Input type="number" value={form.lotCount} onChange={set('lotCount')} placeholder="12" min="1" />
            </FormField>
            <FormField label="Contract Duration (days)">
              <Input type="number" value={form.contractDurationDays} onChange={set('contractDurationDays')} placeholder="180" min="1" />
            </FormField>
            <FormField label="Region">
              <Select value={form.region} onChange={set('region')}>
                {['Astana','Almaty','Shymkent','Aktobe','Taraz','Pavlodar','Ust-Kamenogorsk','Semey','Atyrau','Kyzylorda'].map(r => (
                  <option key={r}>{r}</option>
                ))}
              </Select>
            </FormField>
          </div>

          <div className="flex flex-wrap gap-5 mb-4">
            {[
              { key: 'repeatWinner', label: 'Repeat Winner', tag: 'A4' },
              { key: 'specTailored', label: 'Specification tailored for supplier', tag: 'A6' },
            ].map(({ key, label, tag }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer text-sm text-text-secondary select-none">
                <input type="checkbox" checked={form[key]} onChange={set(key)}
                  className="w-4 h-4 rounded bg-bg-raised border-[rgba(255,255,255,.2)] text-accent focus:ring-accent" />
                {label}
                <span className="px-1.5 py-0.5 text-[9px] font-mono bg-[rgba(59,125,216,.1)] text-accent rounded">{tag}</span>
              </label>
            ))}
          </div>

          <Button variant="primary" size="lg" loading={loading} onClick={runAnalysis}>
            <svg viewBox="0 0 12 12" className="w-3 h-3 stroke-white fill-none stroke-2"><circle cx="5" cy="5" r="4"/><path d="M8.5 8.5L11 11"/></svg>
            Run Analysis
          </Button>
        </CardBody>
      </Card>

      {/* ── Loading ───────────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex items-center gap-3 p-4 bg-bg-surface border border-[rgba(255,255,255,.07)] rounded-lg text-text-secondary text-sm">
          <Spinner /> Analysing lot — applying rules and ML model...
        </div>
      )}

      {/* ── Results ───────────────────────────────────────────────────────── */}
      {result && <AnalysisResult result={result} />}
    </div>
  );
}

function AnalysisResult({ result }) {
  const r   = result;
  const col = scoreColor(r.riskScore);

  const triggeredCodes = (r.triggeredRules || []).map(x => x.code);

  return (
    <div>
      {/* Score card */}
      <Card className="mb-4 overflow-hidden">
        <div className="grid grid-cols-[200px_1fr]">
          {/* Big score */}
          <div className="flex flex-col items-center justify-center gap-2 p-6 border-r border-[rgba(255,255,255,.07)]">
            <div className="text-5xl font-bold font-mono" style={{ color: col }}>{r.riskScore}</div>
            <div className="text-[11px] text-text-muted font-mono">risk score / 100</div>
            <RiskBadge level={r.riskLevel} />
          </div>
          {/* Sub-scores + meta */}
          <div>
            <div className="grid grid-cols-2 divide-x divide-[rgba(255,255,255,.07)]">
              <div className="p-4">
                <div className="text-[10px] font-mono text-text-muted uppercase mb-1">Rule Score</div>
                <div className="text-2xl font-mono font-semibold" style={{ color: scoreColor(r.ruleScore) }}>{r.ruleScore}</div>
                <div className="text-[10px] text-text-muted mt-0.5">0.55 × rule weight</div>
              </div>
              <div className="p-4">
                <div className="text-[10px] font-mono text-text-muted uppercase mb-1">ML Score</div>
                <div className="text-2xl font-mono font-semibold" style={{ color: scoreColor(r.mlScore) }}>{r.mlScore}</div>
                <div className="text-[10px] text-text-muted mt-0.5">0.45 × Isolation Forest</div>
              </div>
            </div>
            <div className="px-4 py-3 border-t border-[rgba(255,255,255,.07)] flex flex-wrap gap-4 items-center">
              <span className="text-[11px] text-text-muted">ML: <MLBadge anomaly={r.mlAnomaly} /></span>
              <span className="text-[11px] text-text-muted">Flags: <span className="font-mono text-text-primary">{r.flagsCount}</span></span>
              <span className="text-[11px] text-text-muted">Organization: <span className="text-text-secondary">{r.customerOrg}</span></span>
            </div>
            <div className="px-4 pb-3 text-[10px] font-mono text-text-muted">
              Formula: Risk = 0.55 × {r.ruleScore} + 0.45 × {r.mlScore} = <span className="text-text-secondary">{r.riskScore}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Rules + Features */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Rules */}
        <Card>
          <CardHeader title={`Detection Rules (${triggeredCodes.length}/6 triggered)`} />
          <CardBody className="p-3 flex flex-col gap-2">
            {Object.entries(RULES_META).map(([code, m]) => {
              const active = triggeredCodes.includes(code);
              return (
                <div key={code} className={`rounded-md p-3 border transition-colors
                  ${active ? 'bg-[rgba(240,79,67,.06)] border-[rgba(240,79,67,.2)]' : 'bg-bg-raised border-[rgba(255,255,255,.05)] opacity-50'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 bg-bg-active rounded">{code}</span>
                    {active && <span className="text-[9px] font-mono text-[#f04f43] uppercase tracking-widest">TRIGGERED</span>}
                    <span className="ml-auto text-[10px] font-mono text-text-muted">wt {m.weight}</span>
                  </div>
                  <div className="text-[12px] font-medium text-text-primary mb-0.5">{m.label}</div>
                  <div className="text-[11px] text-text-muted">{m.desc}</div>
                </div>
              );
            })}
          </CardBody>
        </Card>

        {/* Feature contributions */}
        <Card>
          <CardHeader title="Feature Contributions (z-score)" />
          <CardBody>
            {(r.featureContribs || []).map(f => {
              const abs  = Math.abs(f.zScore);
              const pct  = Math.min(100, (abs / 3) * 100);
              const col  = abs > 1.5 ? '#f04f43' : abs > 0.8 ? '#e09a2e' : '#404c5a';
              const neg  = f.zScore < 0;
              return (
                <div key={f.feature} className="flex items-center gap-2 mb-2">
                  <div className="text-[11px] text-text-secondary w-36 truncate">{f.label}</div>
                  <div className="flex-1 h-2 bg-bg-active rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${neg ? 'ml-auto' : ''}`}
                      style={{ width: `${pct}%`, background: col }} />
                  </div>
                  <div className="text-[10px] font-mono w-10 text-right" style={{ color: col }}>
                    {f.zScore > 0 ? '+' : ''}{f.zScore}
                  </div>
                </div>
              );
            })}
            <p className="text-[10px] text-text-muted mt-3">z-score = deviation from normal distribution. |z| &gt; 1 = significant deviation.</p>
          </CardBody>
        </Card>
      </div>

      {/* GPT Explanation */}
      {r.gptExplanation && <GptBlock gpt={r.gptExplanation} />}

      {/* Disclaimer */}
      <div className="flex items-start gap-2 p-3 bg-[rgba(224,154,46,.06)] border border-[rgba(224,154,46,.2)] rounded-lg text-[11px] text-[#e09a2e] font-mono">
        <span className="flex-shrink-0 mt-0.5">⚠</span>
        <span>{r.disclaimer}</span>
      </div>
    </div>
  );
}

function GptBlock({ gpt }) {
  return (
    <Card className="mb-4">
      <CardHeader title="AI Auditor Report" meta="temperature=0.2">
        <span className="text-[9px] font-mono px-2 py-0.5 bg-bg-active text-text-muted rounded">GPT-4o</span>
      </CardHeader>
      <CardBody className="flex flex-col gap-4">
        {gpt.verdictSummary && (
          <Section label="Verdict">
            <p className="text-sm text-text-secondary">{gpt.verdictSummary}</p>
          </Section>
        )}
        {gpt.riskRationale && (
          <Section label="Risk Rationale">
            <p className="text-sm text-text-secondary">{gpt.riskRationale}</p>
          </Section>
        )}
        {gpt.flagAnalysis?.length > 0 && (
          <Section label="Flag Analysis">
            {gpt.flagAnalysis.map(f => (
              <div key={f.code} className="flex gap-2 mb-1.5">
                <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 bg-bg-active text-accent rounded h-fit flex-shrink-0 mt-0.5">{f.code}</span>
                <span className="text-[12px] text-text-secondary">{f.explanation}</span>
              </div>
            ))}
          </Section>
        )}
        {gpt.recommendedActions?.length > 0 && (
          <Section label="Recommended Actions">
            {gpt.recommendedActions.map((a, i) => (
              <div key={i} className="flex gap-2.5 mb-1.5">
                <span className="w-5 h-5 rounded-full bg-[rgba(59,125,216,.15)] text-accent text-[10px] font-mono flex items-center justify-center flex-shrink-0">{i + 1}</span>
                <span className="text-[12px] text-text-secondary">{a}</span>
              </div>
            ))}
          </Section>
        )}
        {gpt.dataGaps && (
          <Section label="Data Gaps">
            <p className="text-[12px] text-[#e09a2e]">{gpt.dataGaps}</p>
          </Section>
        )}
        {gpt.disclaimer && (
          <div className="text-[10px] text-text-muted font-mono border-t border-[rgba(255,255,255,.05)] pt-3">
            <span className="mr-1">⚠</span>{gpt.disclaimer}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function Section({ label, children }) {
  return (
    <div>
      <div className="text-[10px] font-mono text-text-muted uppercase tracking-wider mb-1.5">{label}</div>
      {children}
    </div>
  );
}

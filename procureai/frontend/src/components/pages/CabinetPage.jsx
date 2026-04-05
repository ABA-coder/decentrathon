// src/components/pages/CabinetPage.jsx
import { useState, useEffect } from 'react';
import { calculatorApi } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { fmtMoney, fmtNumber } from '../../lib/format';
import { Card, CardHeader, CardBody, Button, FormField, Input, Select, Spinner } from '../ui';

export default function CabinetPage() {
  const { user }  = useAuth();
  const toast     = useToast();

  const [form, setForm] = useState({
    priceSmeta: '', pricePurchase: '', quantity: '1', taxRegime: 'SIMPLIFIED',
  });
  const [result, setResult]       = useState(null);
  const [calcLoading, setCalcLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [savedCalcs, setSavedCalcs]   = useState([]);
  const [listLoading, setListLoading] = useState(true);

  const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }));

  // Load saved calculations
  useEffect(() => {
    calculatorApi.list()
      .then(r => setSavedCalcs(r.data))
      .catch(() => {})
      .finally(() => setListLoading(false));
  }, []);

  // Compute in real-time when form changes
  useEffect(() => {
    const s = Number(form.priceSmeta);
    const p = Number(form.pricePurchase);
    const q = Number(form.quantity);
    if (!s || !p || !q) { setResult(null); return; }

    const taxRate   = form.taxRegime === 'VAT' ? 0.12 : 0.03;
    const gross     = (s - p) * q;
    const tax       = gross > 0 ? gross * taxRate : 0;
    const net       = gross - tax;
    const contract  = s * q;
    setResult({
      grossProfit: Math.round(gross * 100) / 100,
      taxAmount:   Math.round(tax   * 100) / 100,
      netProfit:   Math.round(net   * 100) / 100,
      marginPct:   contract > 0 ? Math.round((net / contract) * 10000) / 100 : 0,
      taxRatePct:  taxRate * 100,
      isLoss:      gross < 0,
    });
  }, [form]);

  const handleSave = async () => {
    if (!result || result.isLoss) return;
    setSaveLoading(true);
    try {
      const { data } = await calculatorApi.save({
        priceSmeta:    Number(form.priceSmeta),
        pricePurchase: Number(form.pricePurchase),
        quantity:      Number(form.quantity),
        taxRegime:     form.taxRegime,
      });
      setSavedCalcs(prev => [data, ...prev.slice(0, 9)]);
      toast.success('Calculation saved');
    } catch { toast.error('Save failed'); }
    finally { setSaveLoading(false); }
  };

  const handleDelete = async id => {
    try {
      await calculatorApi.delete(id);
      setSavedCalcs(prev => prev.filter(c => c.id !== id));
      toast.success('Deleted');
    } catch { toast.error('Delete failed'); }
  };

  const initials = user?.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'AU';

  return (
    <div>
      {/* ── Profile header ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 bg-bg-surface border border-[rgba(255,255,255,.07)] rounded-lg p-4 mb-5">
        <div className="w-11 h-11 rounded-full bg-[rgba(59,125,216,.15)] border border-[rgba(59,125,216,.25)] flex items-center justify-center text-sm font-mono font-medium text-accent flex-shrink-0">
          {initials}
        </div>
        <div>
          <div className="text-sm font-semibold text-text-primary">{user?.name || 'Auditor'}</div>
          <div className="text-[11px] text-text-muted font-mono mt-0.5">{user?.organization || user?.role}</div>
        </div>
        <div className="ml-auto flex gap-2">
          <span className="px-2.5 py-1 bg-[rgba(59,125,216,.1)] border border-[rgba(59,125,216,.2)] text-accent text-[11px] font-mono rounded-md">
            {user?.role}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* ── Margin Calculator ────────────────────────────────────────────── */}
        <Card>
          <CardHeader title="Profit Margin Calculator" />
          <CardBody>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <FormField label="Contract Price (₸)">
                <Input type="number" value={form.priceSmeta} onChange={set('priceSmeta')} placeholder="500 000" min="1" />
              </FormField>
              <FormField label="Purchase Price (₸)">
                <Input type="number" value={form.pricePurchase} onChange={set('pricePurchase')} placeholder="380 000" min="1" />
              </FormField>
              <FormField label="Quantity">
                <Input type="number" value={form.quantity} onChange={set('quantity')} placeholder="100" min="1" />
              </FormField>
              <FormField label="Tax Regime">
                <Select value={form.taxRegime} onChange={set('taxRegime')}>
                  <option value="SIMPLIFIED">Simplified Declaration (3%)</option>
                  <option value="VAT">VAT (12%)</option>
                </Select>
              </FormField>
            </div>

            {/* Result */}
            {result && (
              <>
                <div className="h-px bg-[rgba(255,255,255,.07)] mb-4" />
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <Metric label="Gross Profit" value={fmtMoney(result.grossProfit)} color={result.isLoss ? '#f04f43' : undefined} />
                  <Metric label={`Tax (${result.taxRatePct}%)`} value={`-${fmtMoney(result.taxAmount)}`} color="#f04f43" />
                  <Metric label="Net Profit" value={fmtMoney(result.netProfit)} color={result.netProfit < 0 ? '#f04f43' : '#27a862'} large />
                  <Metric label="Margin %" value={`${result.marginPct.toFixed(1)}%`} color="#4d8ef5" large />
                </div>
                {result.isLoss && (
                  <div className="text-[11px] text-[#e09a2e] bg-[rgba(224,154,46,.08)] border border-[rgba(224,154,46,.2)] rounded px-3 py-2 mb-3">
                    ⚠ Cost price exceeds contract price — this is a loss-making contract
                  </div>
                )}
                <Button variant="primary" size="sm" loading={saveLoading} onClick={handleSave} disabled={!result || result.isLoss}>
                  Save Calculation
                </Button>
              </>
            )}
          </CardBody>
        </Card>

        {/* ── Saved Calculations ───────────────────────────────────────────── */}
        <Card>
          <CardHeader title="Saved Calculations" meta={`${savedCalcs.length} records`} />
          <div className="max-h-96 overflow-y-auto">
            {listLoading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-text-muted"><Spinner /><span>Loading...</span></div>
            ) : savedCalcs.length === 0 ? (
              <div className="py-10 text-center text-text-muted text-sm">No saved calculations yet</div>
            ) : savedCalcs.map(c => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3 border-b border-[rgba(255,255,255,.05)] last:border-0 hover:bg-bg-raised transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-sm font-mono font-semibold ${c.netProfit >= 0 ? 'text-[#27a862]' : 'text-[#f04f43]'}`}>
                      {c.netProfit >= 0 ? '+' : ''}{fmtMoney(c.netProfit)}
                    </span>
                    <span className="text-[10px] font-mono text-text-muted">
                      {c.taxRegime === 'VAT' ? 'VAT 12%' : 'Simplified 3%'}
                    </span>
                  </div>
                  <div className="text-[10px] text-text-muted font-mono">
                    {fmtMoney(c.priceSmeta)} − {fmtMoney(c.pricePurchase)} × {fmtNumber(c.quantity)} · margin {Math.round(c.marginPct * 10) / 10}%
                  </div>
                  <div className="text-[10px] text-text-label mt-0.5">
                    {new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
                <button onClick={() => handleDelete(c.id)}
                  className="p-1.5 text-text-muted hover:text-[#f04f43] hover:bg-[rgba(240,79,67,.08)] rounded transition-colors">
                  <svg viewBox="0 0 12 12" className="w-3 h-3 stroke-current fill-none stroke-[1.8]">
                    <path d="M2 3h8M5 3V2h2v1M4 3v6h4V3"/><path d="M5 5v3M7 5v3"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Account info ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader title="Account Details" />
        <CardBody>
          <div className="grid grid-cols-3 gap-4 text-sm">
            {[
              { label: 'Email',        value: user?.email },
              { label: 'Role',         value: user?.role },
              { label: 'Organization', value: user?.organization || '—' },
            ].map(({ label, value }) => (
              <div key={label}>
                <div className="text-[10px] font-mono text-text-muted uppercase tracking-wider mb-1">{label}</div>
                <div className="text-text-secondary">{value}</div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function Metric({ label, value, color, large }) {
  return (
    <div>
      <div className="text-[10px] font-mono text-text-muted uppercase tracking-wider mb-0.5">{label}</div>
      <div className={`font-mono font-semibold ${large ? 'text-lg' : 'text-sm'}`} style={{ color: color || '#dde3ec' }}>
        {value}
      </div>
    </div>
  );
}

// src/components/pages/LotsPage.jsx
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { lotsApi } from '../../lib/api';
import { fmtMoney, fmtNumber, statusLabel } from '../../lib/format';
import { Card, RiskBadge, MLBadge, ScoreBar, Button, Spinner } from '../ui';
import { useToast } from '../../context/ToastContext';

const RISK_OPTS   = ['', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const STATUS_OPTS = ['', 'NEW', 'IN_REVIEW', 'ARCHIVED'];

export default function LotsPage() {
  const navigate = useNavigate();
  const toast    = useToast();

  const [lots, setLots]         = useState([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading]   = useState(true);
  const [sortKey, setSortKey]   = useState('riskScore');
  const [sortDir, setSortDir]   = useState('desc');

  const [filters, setFilters] = useState({
    search: '', riskLevel: '', region: '', category: '', status: '', minScore: '',
  });

  const setFilter = key => e => {
    setFilters(f => ({ ...f, [key]: e.target.value }));
    setPage(1);
  };

  const fetchLots = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, pageSize: 20, ...filters };
      Object.keys(params).forEach(k => params[k] === '' && delete params[k]);
      const { data } = await lotsApi.list(params);
      setLots(data.items || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      toast.error('Failed to load lots');
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => { fetchLots(); }, [fetchLots]);

  const handleTakeToWork = async (e, id) => {
    e.stopPropagation();
    try {
      await lotsApi.updateStatus(id, { status: 'IN_REVIEW' });
      toast.success('Lot moved to In Review');
      fetchLots();
    } catch { toast.error('Update failed'); }
  };

  const sort = key => {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const sortedLots = [...lots].sort((a, b) => {
    const av = a[sortKey], bv = b[sortKey];
    const dir = sortDir === 'desc' ? -1 : 1;
    if (typeof av === 'number') return dir * (av - bv);
    return dir * String(av || '').localeCompare(String(bv || ''));
  });

  const SortTh = ({ k, label }) => (
    <th onClick={() => sort(k)}
      className="px-3 py-2.5 text-left text-[10px] font-mono text-text-muted uppercase tracking-wider cursor-pointer hover:text-text-secondary whitespace-nowrap select-none">
      {label} {sortKey === k ? (sortDir === 'desc' ? '↓' : '↑') : ''}
    </th>
  );

  return (
    <div>
      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          value={filters.search} onChange={setFilter('search')} placeholder="Search ID, title, organization..."
          className="flex-1 min-w-48 bg-bg-raised border border-[rgba(255,255,255,.07)] rounded-md px-3 py-1.5 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-[rgba(77,142,245,.4)] transition-colors"
        />
        <FilterSelect value={filters.riskLevel}  onChange={setFilter('riskLevel')}  opts={RISK_OPTS}   placeholder="All risk levels" map={{ '': 'All Risk Levels', CRITICAL: 'Critical', HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low' }} />
        <FilterSelect value={filters.status}     onChange={setFilter('status')}     opts={STATUS_OPTS} placeholder="All statuses"   map={{ '': 'All Statuses', NEW: 'New', IN_REVIEW: 'In Review', ARCHIVED: 'Archived' }} />
        <input
          type="number" min="0" max="100" value={filters.minScore} onChange={setFilter('minScore')}
          placeholder="Min score"
          className="w-28 bg-bg-raised border border-[rgba(255,255,255,.07)] rounded-md px-3 py-1.5 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-[rgba(77,142,245,.4)] transition-colors"
        />
        <span className="flex items-center text-[11px] text-text-muted font-mono">{fmtNumber(total)} lots</span>
      </div>

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-[rgba(255,255,255,.07)]">
                <SortTh k="lotNumber"       label="Lot ID" />
                <th className="px-3 py-2.5 text-left text-[10px] font-mono text-text-muted uppercase tracking-wider">Title</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-mono text-text-muted uppercase tracking-wider">Organization</th>
                <SortTh k="region"          label="Region" />
                <SortTh k="category"        label="Category" />
                <SortTh k="initialPriceKzt" label="Price" />
                <SortTh k="bidCount"        label="Bids" />
                <SortTh k="riskScore"       label="Risk Score ↓" />
                <th className="px-3 py-2.5 text-left text-[10px] font-mono text-text-muted uppercase tracking-wider">Level</th>
                <th className="px-3 py-2.5 text-center text-[10px] font-mono text-text-muted uppercase tracking-wider">Flags</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-mono text-text-muted uppercase tracking-wider">ML</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-mono text-text-muted uppercase tracking-wider">Status</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-mono text-text-muted uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={13} className="px-4 py-12 text-center">
                  <div className="flex items-center justify-center gap-2 text-text-muted"><Spinner /><span>Loading lots...</span></div>
                </td></tr>
              ) : sortedLots.length === 0 ? (
                <tr><td colSpan={13} className="px-4 py-12 text-center text-text-muted text-sm">No lots found for the selected filters</td></tr>
              ) : sortedLots.map(t => (
                <tr key={t.id}
                  onClick={() => navigate('/analyze', { state: { lot: t } })}
                  className="border-b border-[rgba(255,255,255,.04)] hover:bg-bg-raised cursor-pointer transition-colors">
                  <td className="px-3 py-2 font-mono text-[10px] text-text-muted whitespace-nowrap">{t.lotNumber}</td>
                  <td className="px-3 py-2 max-w-[180px] truncate text-text-secondary" title={t.title}>{t.title}</td>
                  <td className="px-3 py-2 max-w-[130px] truncate text-text-muted" title={t.customerOrg}>{t.customerOrg}</td>
                  <td className="px-3 py-2 text-text-muted whitespace-nowrap">{t.region}</td>
                  <td className="px-3 py-2 text-text-muted whitespace-nowrap">{t.category}</td>
                  <td className="px-3 py-2 font-mono whitespace-nowrap">{fmtMoney(t.initialPriceKzt)}</td>
                  <td className="px-3 py-2 font-mono text-center">{t.bidCount}</td>
                  <td className="px-3 py-2 w-28">
                    {t.riskScore != null ? <ScoreBar score={t.riskScore} level={t.riskLevel} /> : <span className="text-text-muted text-[10px]">—</span>}
                  </td>
                  <td className="px-3 py-2">{t.riskLevel ? <RiskBadge level={t.riskLevel} /> : '—'}</td>
                  <td className="px-3 py-2 font-mono text-center">{t.flagsCount ?? 0}</td>
                  <td className="px-3 py-2"><MLBadge anomaly={t.mlAnomaly} /></td>
                  <td className="px-3 py-2">
                    <StatusPill status={t.status} />
                  </td>
                  <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1.5">
                      <Button size="sm" variant="analyze" onClick={() => navigate('/analyze', { state: { lot: t } })}>
                        AI Analysis
                      </Button>
                      {t.status === 'NEW' && (
                        <Button size="sm" variant="default" onClick={e => handleTakeToWork(e, t.id)}>
                          Take
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[rgba(255,255,255,.07)]">
            <span className="text-[11px] text-text-muted font-mono">
              Page {page} of {totalPages} · {fmtNumber(total)} total
            </span>
            <div className="flex gap-1">
              <Button size="sm" disabled={page <= 1}           onClick={() => setPage(p => p - 1)}>← Prev</Button>
              <Button size="sm" disabled={page >= totalPages}  onClick={() => setPage(p => p + 1)}>Next →</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function StatusPill({ status }) {
  const map = {
    NEW:       'bg-[rgba(59,125,216,.1)] text-[#4d8ef5]',
    IN_REVIEW: 'bg-[rgba(224,154,46,.1)] text-[#e09a2e]',
    ARCHIVED:  'bg-[rgba(64,76,90,.2)]   text-text-muted',
  };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono ${map[status] || ''}`}>
      {statusLabel(status)}
    </span>
  );
}

function FilterSelect({ value, onChange, opts, map }) {
  return (
    <select value={value} onChange={onChange}
      className="bg-bg-raised border border-[rgba(255,255,255,.07)] rounded-md px-2.5 py-1.5 text-sm text-text-secondary focus:outline-none focus:border-[rgba(77,142,245,.4)] transition-colors">
      {opts.map(o => <option key={o} value={o}>{map[o] || o}</option>)}
    </select>
  );
}

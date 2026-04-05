// src/components/ui/index.jsx — Shared UI primitives
import { forwardRef } from 'react';

// ── Badge ─────────────────────────────────────────────────────────────────────
const RISK_BADGE = {
  CRITICAL: 'bg-[rgba(240,79,67,.12)] text-[#f04f43] border border-[rgba(240,79,67,.25)]',
  HIGH:     'bg-[rgba(224,154,46,.12)] text-[#e09a2e] border border-[rgba(224,154,46,.25)]',
  MEDIUM:   'bg-[rgba(201,185,58,.10)] text-[#c9b93a] border border-[rgba(201,185,58,.25)]',
  LOW:      'bg-[rgba(39,168,98,.12)]  text-[#27a862] border border-[rgba(39,168,98,.25)]',
  INFO:     'bg-[rgba(59,125,216,.12)] text-[#4d8ef5] border border-[rgba(59,125,216,.25)]',
  ANOMALY:  'bg-[rgba(240,79,67,.12)] text-[#f04f43] border border-[rgba(240,79,67,.25)]',
  NORMAL:   'bg-[rgba(39,168,98,.12)]  text-[#27a862] border border-[rgba(39,168,98,.25)]',
};

export function RiskBadge({ level }) {
  const cls = RISK_BADGE[level] || RISK_BADGE.INFO;
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium whitespace-nowrap ${cls}`}>
      {level}
    </span>
  );
}

export function MLBadge({ anomaly }) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium
      ${anomaly ? RISK_BADGE.ANOMALY : RISK_BADGE.NORMAL}`}>
      {anomaly ? 'ANOMALY' : 'NORMAL'}
    </span>
  );
}

// ── Button ────────────────────────────────────────────────────────────────────
export const Button = forwardRef(({ children, variant = 'default', size = 'md', className = '', disabled, loading, ...props }, ref) => {
  const base = 'inline-flex items-center gap-1.5 font-medium rounded-md transition-all duration-150 whitespace-nowrap disabled:opacity-50 disabled:pointer-events-none';
  const sizes = {
    sm: 'px-2.5 py-1 text-[11px]',
    md: 'px-3 py-1.5 text-xs',
    lg: 'px-4.5 py-2 text-sm',
  };
  const variants = {
    default: 'bg-bg-raised border border-border-md text-text-secondary hover:bg-bg-hover hover:text-text-primary hover:border-border-lg',
    primary: 'bg-accent border border-accent text-white hover:bg-accent-hover',
    danger:  'bg-[rgba(240,79,67,.12)] border border-[rgba(240,79,67,.25)] text-[#f04f43] hover:bg-[rgba(240,79,67,.18)]',
    ghost:   'bg-transparent border border-transparent text-text-secondary hover:text-text-primary hover:bg-bg-raised',
    analyze: 'bg-[rgba(59,125,216,.12)] border border-[rgba(59,125,216,.25)] text-accent hover:bg-[rgba(59,125,216,.2)]',
  };
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`${base} ${sizes[size] || sizes.md} ${variants[variant] || variants.default} ${className}`}
      {...props}
    >
      {loading && <div className="spinner" style={{ width: 12, height: 12 }} />}
      {children}
    </button>
  );
});
Button.displayName = 'Button';

// ── Card ──────────────────────────────────────────────────────────────────────
export function Card({ children, className = '' }) {
  return (
    <div className={`bg-bg-surface border border-[rgba(255,255,255,.07)] rounded-lg ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ title, meta, children, className = '' }) {
  return (
    <div className={`flex items-center justify-between px-4 py-3 border-b border-[rgba(255,255,255,.07)] ${className}`}>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-text-primary">{title}</span>
        {meta && <span className="text-[11px] text-text-muted font-mono">{meta}</span>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}

export function CardBody({ children, className = '' }) {
  return <div className={`p-4 ${className}`}>{children}</div>;
}

// ── Spinner ───────────────────────────────────────────────────────────────────
export function Spinner({ size = 16 }) {
  return <div className="spinner" style={{ width: size, height: size }} />;
}

// ── KPI card ──────────────────────────────────────────────────────────────────
export function KpiCard({ label, value, sub, accent }) {
  const accents = {
    red:    'border-[rgba(240,79,67,.2)]  bg-[rgba(240,79,67,.06)]',
    amber:  'border-[rgba(224,154,46,.2)] bg-[rgba(224,154,46,.06)]',
    yellow: 'border-[rgba(201,185,58,.2)] bg-[rgba(201,185,58,.06)]',
    green:  'border-[rgba(39,168,98,.2)]  bg-[rgba(39,168,98,.06)]',
    blue:   'border-[rgba(59,125,216,.2)] bg-[rgba(59,125,216,.06)]',
  };
  return (
    <div className={`rounded-lg border p-3.5 ${accentMap(accent)}`}>
      <div className="text-[10px] font-mono text-text-muted uppercase tracking-widest mb-1">{label}</div>
      <div className="text-xl font-semibold text-text-primary leading-none mb-1">
        {value ?? <div className="skel w-16 h-5" />}
      </div>
      {sub && <div className="text-[10px] text-text-muted">{sub}</div>}
    </div>
  );
}

function accentMap(a) {
  const m = {
    red:    'border-[rgba(240,79,67,.2)]  bg-[rgba(240,79,67,.04)]',
    amber:  'border-[rgba(224,154,46,.2)] bg-[rgba(224,154,46,.04)]',
    yellow: 'border-[rgba(201,185,58,.2)] bg-[rgba(201,185,58,.04)]',
    green:  'border-[rgba(39,168,98,.2)]  bg-[rgba(39,168,98,.04)]',
    blue:   'border-[rgba(59,125,216,.2)] bg-[rgba(59,125,216,.04)]',
  };
  return m[a] || 'border-[rgba(255,255,255,.07)] bg-bg-surface';
}

// ── FormField ─────────────────────────────────────────────────────────────────
export function FormField({ label, hint, error, children, required }) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-[11px] font-mono text-text-muted uppercase tracking-wider">
          {label}{required && <span className="text-[#f04f43] ml-0.5">*</span>}
        </label>
      )}
      {children}
      {hint  && <span className="text-[10px] text-text-muted">{hint}</span>}
      {error && <span className="text-[11px] text-[#f04f43]">{error}</span>}
    </div>
  );
}

export function Input({ className = '', ...props }) {
  return (
    <input
      className={`w-full bg-bg-raised border border-[rgba(255,255,255,.07)] rounded-md px-3 py-1.5
        text-sm text-text-primary placeholder-text-muted
        focus:outline-none focus:border-[rgba(77,142,245,.5)] focus:ring-1 focus:ring-[rgba(77,142,245,.2)]
        transition-colors ${className}`}
      {...props}
    />
  );
}

export function Select({ className = '', children, ...props }) {
  return (
    <select
      className={`w-full bg-bg-raised border border-[rgba(255,255,255,.07)] rounded-md px-3 py-1.5
        text-sm text-text-primary
        focus:outline-none focus:border-[rgba(77,142,245,.5)]
        transition-colors ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

// ── Score bar ─────────────────────────────────────────────────────────────────
export function ScoreBar({ score, level }) {
  const colorMap = { CRITICAL: '#f04f43', HIGH: '#e09a2e', MEDIUM: '#c9b93a', LOW: '#27a862' };
  const color = colorMap[level] || '#4d8ef5';
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono font-medium text-[12px] w-8" style={{ color }}>{score}</span>
      <div className="flex-1 h-1 bg-bg-active rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, background: color }} />
      </div>
    </div>
  );
}

// ── HBar (horizontal bar chart row) ──────────────────────────────────────────
export function HBar({ label, value, max, color = '#4d8ef5' }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="text-[11px] text-text-secondary w-44 truncate" title={label}>{label}</div>
      <div className="flex-1 h-3 bg-bg-active rounded-sm overflow-hidden">
        <div className="h-full rounded-sm flex items-center justify-end pr-1.5 text-[9px] font-mono"
          style={{ width: `${pct}%`, background: color, minWidth: value > 0 ? 20 : 0 }}>
          {value > 0 && <span className="text-white/80">{value}</span>}
        </div>
      </div>
      <div className="text-[10px] font-mono text-text-muted w-7 text-right">{pct}%</div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
export function EmptyState({ icon, title, sub }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-text-muted">
      {icon && <div className="opacity-30 mb-1">{icon}</div>}
      <span className="text-sm">{title}</span>
      {sub && <span className="text-[11px] text-text-label">{sub}</span>}
    </div>
  );
}

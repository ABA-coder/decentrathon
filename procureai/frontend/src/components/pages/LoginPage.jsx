// src/components/pages/LoginPage.jsx
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function LoginPage() {
  const { login, register, loading } = useAuth();
  const [mode, setMode]       = useState('login');      // 'login' | 'register'
  const [form, setForm]       = useState({ email: '', password: '', name: '', organization: '' });
  const [error, setError]     = useState('');

  const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    const result = mode === 'login'
      ? await login(form.email, form.password)
      : await register(form);

    if (!result.ok) setError(result.error);
  };

  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-accent to-blue-700 flex items-center justify-center">
            <svg viewBox="0 0 16 16" className="w-5 h-5 stroke-white fill-none stroke-2">
              <path d="M2 10L8 2L14 10"/><path d="M5 13L11 13"/>
              <circle cx="8" cy="10" r="2" fill="white" stroke="none"/>
            </svg>
          </div>
          <div>
            <div className="font-semibold text-base text-text-primary tracking-tight">ProcureAI KZ</div>
            <div className="text-[10px] text-text-muted font-mono uppercase tracking-widest">Procurement Intelligence</div>
          </div>
        </div>

        {/* Card */}
        <div className="bg-bg-surface border border-[rgba(255,255,255,.07)] rounded-lg overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-[rgba(255,255,255,.07)]">
            {['login', 'register'].map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); }}
                className={`flex-1 py-3 text-[12px] font-medium transition-colors capitalize
                  ${mode === m
                    ? 'text-accent border-b-2 border-accent bg-[rgba(59,125,216,.06)]'
                    : 'text-text-muted hover:text-text-secondary'}`}
              >
                {m === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
            {mode === 'register' && (
              <>
                <Field label="Full Name" type="text" value={form.name} onChange={set('name')} placeholder="Audit Officer" required />
                <Field label="Organization" type="text" value={form.organization} onChange={set('organization')} placeholder="KKSON Committee" />
              </>
            )}
            <Field label="Email" type="email" value={form.email} onChange={set('email')} placeholder="you@example.kz" required />
            <Field label="Password" type="password" value={form.password} onChange={set('password')} placeholder="••••••••" required />

            {error && (
              <div className="text-[11px] text-[#f04f43] bg-[rgba(240,79,67,.08)] border border-[rgba(240,79,67,.2)] rounded-md px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 w-full py-2.5 bg-accent text-white text-sm font-medium rounded-md hover:bg-accent-hover disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {loading && <div className="spinner" style={{ width: 14, height: 14 }} />}
              {mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>

            {/* Demo hint */}
            {mode === 'login' && (
              <div className="text-center text-[10px] text-text-label font-mono">
                Demo: admin@procureai.kz / admin123
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

function Field({ label, ...props }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-mono text-text-muted uppercase tracking-wider">{label}</label>
      <input
        className="w-full bg-bg-raised border border-[rgba(255,255,255,.07)] rounded-md px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-[rgba(77,142,245,.4)] focus:ring-1 focus:ring-[rgba(77,142,245,.15)] transition-colors"
        {...props}
      />
    </div>
  );
}

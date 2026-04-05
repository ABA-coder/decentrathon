// src/components/layout/AppLayout.jsx
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const NAV = [
  { to: '/dashboard', label: 'Dashboard',      icon: GridIcon },
  { to: '/lots',      label: 'Lot Registry',   icon: ListIcon,  badge: 'critical' },
  { to: '/analyze',   label: 'Analyze Lot',    icon: SearchIcon },
  { to: '/cabinet',   label: 'My Cabinet',     icon: UserIcon },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="flex min-h-screen bg-bg-base text-text-primary">
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <nav className="w-sidebar min-h-screen bg-bg-surface border-r border-[rgba(255,255,255,.07)] flex flex-col fixed top-0 left-0 bottom-0 z-20">
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-4 py-[18px] border-b border-[rgba(255,255,255,.07)]">
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-accent to-blue-700 flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 16 16" className="w-4 h-4 stroke-white fill-none stroke-2">
              <path d="M2 10L8 2L14 10"/><path d="M5 13L11 13"/>
              <circle cx="8" cy="10" r="2" fill="white" stroke="none"/>
            </svg>
          </div>
          <div>
            <div className="text-[13px] font-semibold tracking-tight">ProcureAI KZ</div>
            <div className="text-[10px] text-text-muted font-mono uppercase tracking-widest mt-0.5">Procurement · AI</div>
          </div>
        </div>

        {/* Nav items */}
        <div className="pt-5 pb-2 flex-1">
          <span className="block px-4 pb-1.5 text-[10px] text-text-label font-mono uppercase tracking-widest">Navigation</span>
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-4 py-2 text-[13px] cursor-pointer border-l-2 transition-all duration-150
                ${isActive
                  ? 'text-accent bg-[rgba(59,125,216,.08)] border-accent'
                  : 'text-text-secondary border-transparent hover:text-text-primary hover:bg-bg-raised'}`
              }
            >
              <Icon />
              {label}
            </NavLink>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[rgba(255,255,255,.07)]">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-[rgba(59,125,216,.15)] border border-[rgba(59,125,216,.25)] flex items-center justify-center text-[10px] font-mono text-accent">
              {user?.name?.slice(0, 2).toUpperCase() || 'AU'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-medium truncate">{user?.name || 'Auditor'}</div>
              <div className="text-[10px] text-text-muted truncate">{user?.role}</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] text-text-muted rounded-md hover:bg-bg-raised hover:text-[#f04f43] transition-colors"
          >
            <LogoutIcon /> Sign out
          </button>
        </div>
      </nav>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <div className="ml-sidebar flex-1 flex flex-col min-h-screen">
        {/* Topbar */}
        <header className="h-topbar bg-bg-surface border-b border-[rgba(255,255,255,.07)] flex items-center justify-between px-6 sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-text-muted font-mono">procure-ai</span>
            <span className="text-text-label text-sm">›</span>
            <span className="text-[13px] font-medium">Dashboard</span>
          </div>
          <div className="flex items-center gap-2">
            <NavLink to="/cabinet" className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-text-secondary bg-bg-raised border border-[rgba(255,255,255,.07)] rounded-md hover:bg-bg-hover hover:text-text-primary transition-colors">
              <UserIcon /> Cabinet
            </NavLink>
            <NavLink to="/analyze" className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-white bg-accent border border-accent rounded-md hover:bg-accent-hover transition-colors">
              <SearchIcon /> New Analysis
            </NavLink>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

// ── Inline icons ──────────────────────────────────────────────────────────────
function GridIcon()   { return <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 stroke-current fill-none stroke-[1.6]"><rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg>; }
function ListIcon()   { return <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 stroke-current fill-none stroke-[1.6]"><path d="M2 4h12M2 8h12M2 12h8"/></svg>; }
function SearchIcon() { return <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 stroke-current fill-none stroke-[1.6]"><circle cx="7" cy="7" r="5"/><path d="M11 11L15 15"/></svg>; }
function UserIcon()   { return <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 stroke-current fill-none stroke-[1.6]"><circle cx="8" cy="5" r="3"/><path d="M2 14c0-3 2.7-5 6-5s6 2 6 5"/></svg>; }
function LogoutIcon() { return <svg viewBox="0 0 16 16" className="w-3 h-3 stroke-current fill-none stroke-[1.6]"><path d="M10 12l4-4-4-4M14 8H6M6 14H3a1 1 0 01-1-1V3a1 1 0 011-1h3"/></svg>; }

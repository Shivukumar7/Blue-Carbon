import { Link } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { Logo } from './ui.jsx';

const ROLE_LABEL = {
  admin: 'Government registry',
  leader: 'Community leader',
  member: 'Community member',
};

/**
 * Chrome shared by all three dashboards: sticky header, role identity, and an
 * optional tab strip supplied by the page.
 */
export default function AppShell({ tabs, activeTab, onTab, subtitle, actions, children }) {
  const { user, logout } = useAuth();

  return (
    <div className="console grain relative">
      <header className="sticky top-0 z-[500] border-b border-white/8 bg-abyss-950/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1400px] items-center gap-4 px-4 py-3 sm:px-6">
          <Link to="/" className="text-slate-100 transition hover:opacity-80" aria-label="Home">
            <Logo dark />
          </Link>

          <div className="ml-2 hidden min-w-0 border-l border-white/10 pl-4 sm:block">
            <p className="truncate text-sm font-semibold text-slate-100">{user?.full_name}</p>
            <p className="truncate text-[11px] text-slate-400">
              {ROLE_LABEL[user?.role]} · @{user?.username}
            </p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {actions}
            <button
              type="button"
              onClick={logout}
              className="btn-ghost !px-3"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut size={15} aria-hidden />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>

        {tabs?.length > 0 && (
          <nav
            aria-label="Dashboard sections"
            className="scrollbar-slim mx-auto flex max-w-[1400px] gap-1 overflow-x-auto px-3 sm:px-5"
          >
            {tabs.map((tab) => {
              const active = tab.id === activeTab;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onTab(tab.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`relative shrink-0 cursor-pointer px-3.5 py-2.5 text-[13px] font-medium transition
                    ${active ? 'text-tide-300' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  <span className="flex items-center gap-2">
                    {tab.icon && <tab.icon size={15} aria-hidden />}
                    {tab.label}
                    {tab.count > 0 && (
                      <span className="tabular rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] text-slate-300">
                        {tab.count}
                      </span>
                    )}
                  </span>
                  {active && (
                    <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-tide-400" aria-hidden />
                  )}
                </button>
              );
            })}
          </nav>
        )}
      </header>

      {subtitle && (
        <div className="mx-auto max-w-[1400px] px-4 pt-6 sm:px-6">{subtitle}</div>
      )}

      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}

export function PageHead({ eyebrow, title, description, right }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="label mb-1.5">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50 sm:text-[27px]">{title}</h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-400">{description}</p>
        )}
      </div>
      {right}
    </div>
  );
}

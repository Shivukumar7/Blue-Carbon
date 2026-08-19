import { AlertTriangle, CheckCircle2, Info, Loader2 } from 'lucide-react';

const TONES = {
  tide: 'bg-tide-500/15 text-tide-300 ring-1 ring-inset ring-tide-500/30',
  amber: 'bg-amber-400/15 text-amber-300 ring-1 ring-inset ring-amber-400/30',
  sky: 'bg-sky-400/15 text-sky-300 ring-1 ring-inset ring-sky-400/30',
  violet: 'bg-violet-400/15 text-violet-300 ring-1 ring-inset ring-violet-400/30',
  rose: 'bg-rose-400/15 text-rose-300 ring-1 ring-inset ring-rose-400/30',
  slate: 'bg-white/8 text-slate-300 ring-1 ring-inset ring-white/12',
};

export function Badge({ tone = 'slate', children, className = '' }) {
  return <span className={`chip ${TONES[tone] ?? TONES.slate} ${className}`}>{children}</span>;
}

export function Panel({ title, action, children, className = '', bodyClass = 'p-5' }) {
  return (
    <section className={`panel-solid overflow-hidden ${className}`}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-4 border-b border-white/8 px-5 py-4">
          <h2 className="text-sm font-semibold tracking-tight text-slate-100">{title}</h2>
          {action}
        </header>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}

/** Big number tile. `hint` sits underneath, `icon` is a lucide component. */
export function Stat({ label, value, unit, hint, icon: Icon, tone = 'tide' }) {
  const accent = {
    tide: 'text-tide-300',
    amber: 'text-amber-300',
    sky: 'text-sky-300',
    slate: 'text-slate-200',
  }[tone];

  return (
    <div className="panel-solid group relative overflow-hidden p-5">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-tide-500/10 blur-2xl
                   transition-opacity duration-500 group-hover:opacity-100"
      />
      <div className="flex items-start justify-between gap-3">
        <p className="label">{label}</p>
        {Icon && <Icon size={16} className={`${accent} opacity-80`} aria-hidden />}
      </div>
      <p className="mt-3 flex items-baseline gap-1.5">
        <span className={`tabular text-[26px] font-semibold leading-none ${accent}`}>{value}</span>
        {unit && <span className="text-xs font-medium text-slate-400">{unit}</span>}
      </p>
      {hint && <p className="mt-2 text-xs leading-relaxed text-slate-400">{hint}</p>}
    </div>
  );
}

export function Alert({ kind = 'info', children }) {
  if (!children) return null;
  const map = {
    info: ['border-sky-400/30 bg-sky-400/10 text-sky-100', Info],
    error: ['border-rose-400/35 bg-rose-500/10 text-rose-100', AlertTriangle],
    success: ['border-tide-400/35 bg-tide-500/10 text-tide-100', CheckCircle2],
  };
  const [cls, Icon] = map[kind] ?? map.info;
  return (
    <div
      role={kind === 'error' ? 'alert' : 'status'}
      className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm ${cls}`}
    >
      <Icon size={16} className="mt-0.5 shrink-0" aria-hidden />
      <span className="leading-relaxed">{children}</span>
    </div>
  );
}

export function Field({ label, hint, error, children, required }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-slate-300">
        {label}
        {required && <span className="text-tide-400">*</span>}
      </span>
      {children}
      {hint && !error && <span className="mt-1 block text-[11px] text-slate-500">{hint}</span>}
      {error && <span className="mt-1 block text-[11px] text-rose-300">{error}</span>}
    </label>
  );
}

export function Spinner({ label = 'Loading' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
      <Loader2 size={16} className="animate-spin" aria-hidden />
      {label}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      {Icon && (
        <span className="grid h-11 w-11 place-items-center rounded-full bg-white/5 text-slate-400">
          <Icon size={20} aria-hidden />
        </span>
      )}
      <p className="text-sm font-semibold text-slate-200">{title}</p>
      {children && <p className="max-w-sm text-xs leading-relaxed text-slate-400">{children}</p>}
      {action}
    </div>
  );
}

/** Slim horizontal meter used for participation and progress. */
export function Meter({ value, tone = 'tide', className = '' }) {
  const width = `${Math.max(0, Math.min(1, value)) * 100}%`;
  const bar = {
    tide: 'bg-gradient-to-r from-tide-500 to-tide-300',
    amber: 'bg-gradient-to-r from-sun-500 to-sun-300',
    sky: 'bg-gradient-to-r from-sky-500 to-cyan-300',
  }[tone];
  return (
    <div className={`h-1.5 overflow-hidden rounded-full bg-white/8 ${className}`}>
      <div className={`h-full rounded-full transition-[width] duration-700 ${bar}`} style={{ width }} />
    </div>
  );
}

export function Logo({ compact = false, dark = false }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className="h-8 w-8 shrink-0" aria-hidden>
        <rect width="32" height="32" rx="9" fill={dark ? '#04151A' : '#052F2A'} />
        <path
          d="M16 5c3.6 3.4 5.4 6.6 5.4 9.6 0 3.2-2.4 5.6-5.4 5.6s-5.4-2.4-5.4-5.6C10.6 11.6 12.4 8.4 16 5Z"
          fill="#34D399"
        />
        <path
          d="M5 23.5c2.2-1.6 4-1.6 6.2 0 2.2 1.6 4 1.6 6.2 0 2.2-1.6 4-1.6 6.2 0"
          stroke="#22D3EE"
          strokeWidth="2.2"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
      {!compact && (
        <span className="leading-tight">
          <span className="block text-[15px] font-semibold tracking-tight">Blue Carbon Registry</span>
          <span className="block text-[10px] uppercase tracking-[0.18em] opacity-60">
            Coastal restoration &amp; credits
          </span>
        </span>
      )}
    </span>
  );
}

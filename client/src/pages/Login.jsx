import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, AtSign, Eye, EyeOff, KeyRound, Landmark, Loader2, Lock, MapPin,
  Phone, ShieldCheck, Sprout, User, UserRound, Users,
} from 'lucide-react';
import { HOME_FOR, useAuth } from '../lib/auth.jsx';
import { Logo } from '../components/ui.jsx';

const ROLES = [
  {
    id: 'member',
    label: 'Member',
    icon: Sprout,
    tagline: 'Tend one parcel',
    blurb: 'You look after a single parcel. Log a photo and your meter readings each day to earn a credit.',
  },
  {
    id: 'leader',
    label: 'Leader',
    icon: Users,
    tagline: 'Run the collective',
    blurb: 'You build the roster, apply for the programme and keep the community reporting every day.',
  },
  {
    id: 'admin',
    label: 'Government',
    icon: Landmark,
    tagline: 'Approve and oversee',
    blurb: 'Registry officers review applications, survey sites on the ground and approve project boundaries.',
  },
];

/** Text input with a leading icon, used for every field on this page. */
function IconField({ icon: Icon, label, hint, trailing, ...props }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-abyss-900">{label}</span>
      <div className="relative">
        <Icon
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          aria-hidden
        />
        <input {...props} className={`field-light pl-9 ${trailing ? 'pr-10' : ''}`} />
        {trailing}
      </div>
      {hint && <span className="mt-1 block text-[11px] text-slate-500">{hint}</span>}
    </label>
  );
}

export default function Login() {
  const { user, login, register } = useAuth();
  const [params] = useSearchParams();

  const [role, setRole] = useState(
    ROLES.some((r) => r.id === params.get('tab')) ? params.get('tab') : 'member'
  );
  const [mode, setMode] = useState(params.get('mode') === 'register' ? 'register' : 'login');
  const [form, setForm] = useState({
    username: '', password: '', email: '', fullName: '', phone: '', village: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Government accounts are provisioned by the registry office, never self-served.
  useEffect(() => {
    if (role === 'admin' && mode === 'register') setMode('login');
  }, [role, mode]);

  const active = useMemo(() => ROLES.find((r) => r.id === role), [role]);

  if (user) return <Navigate to={HOME_FOR[user.role]} replace />;

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') {
        await login({ username: form.username.trim().toLowerCase(), password: form.password, role });
      } else {
        await register({
          username: form.username.trim().toLowerCase(),
          password: form.password,
          email: form.email.trim(),
          fullName: form.fullName.trim(),
          phone: form.phone.trim(),
          village: form.village.trim(),
          role,
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-sand lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* ================================================== brand / context */}
      <aside className="relative isolate hidden overflow-hidden bg-abyss-950 px-12 py-12 text-white lg:flex lg:flex-col">
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            backgroundImage:
              'radial-gradient(820px 540px at 18% -6%, rgba(16,185,129,0.30), transparent 62%),'
              + 'radial-gradient(700px 460px at 96% 96%, rgba(34,211,238,0.20), transparent 60%),'
              + 'linear-gradient(180deg, #04151A 0%, #062229 60%, #04151A 100%)',
          }}
        />
        {/* a faint tide line across the lower third */}
        <svg
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-24 -z-10 w-full opacity-[0.13]"
          viewBox="0 0 600 120"
          preserveAspectRatio="none"
        >
          <path d="M0 60 q 75 -46 150 0 t 150 0 t 150 0 t 150 0" stroke="#34D399" strokeWidth="2" fill="none" />
          <path d="M0 86 q 75 -46 150 0 t 150 0 t 150 0 t 150 0" stroke="#22D3EE" strokeWidth="2" fill="none" />
        </svg>

        <Link to="/" className="inline-flex w-fit"><Logo dark /></Link>

        <div className="mt-auto max-w-md">
          <h1 className="text-[34px] font-bold leading-[1.12] tracking-tight">
            One coast, three roles,
            <span className="block bg-gradient-to-r from-tide-300 to-cyan-300 bg-clip-text text-transparent">
              a single shared record.
            </span>
          </h1>

          <ul className="mt-9 space-y-2.5">
            {ROLES.map((r) => {
              const on = r.id === role;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => { setRole(r.id); setError(''); }}
                    aria-pressed={on}
                    className={`flex w-full cursor-pointer items-center gap-3.5 rounded-xl border p-3.5 text-left
                      transition duration-300
                      ${on
                        ? 'border-tide-400/40 bg-tide-500/10'
                        : 'border-white/8 bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.05]'}`}
                  >
                    <span
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg transition
                        ${on ? 'bg-tide-500/20 text-tide-300' : 'bg-white/6 text-slate-400'}`}
                    >
                      <r.icon size={16} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block text-sm font-semibold ${on ? 'text-white' : 'text-slate-300'}`}>
                        {r.label}
                      </span>
                      <span className="block text-xs text-slate-500">{r.tagline}</span>
                    </span>
                    {on && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-tide-400" aria-hidden />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <p className="mt-10 flex items-start gap-2.5 border-t border-white/8 pt-6 text-xs leading-relaxed text-slate-500">
          <ShieldCheck size={15} className="mt-0.5 shrink-0 text-tide-400" aria-hidden />
          Every project on this registry is surveyed on the ground by a government officer before
          a single parcel is assigned.
        </p>
      </aside>

      {/* ============================================================= form */}
      <main className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center justify-between lg:hidden">
            <Link to="/" className="text-abyss-900"><Logo /></Link>
          </div>

          <h2 className="text-[26px] font-bold tracking-tight text-abyss-900">
            {mode === 'login' ? 'Sign in to the registry' : 'Create your account'}
          </h2>
          <p className="mt-1.5 text-sm text-slate-500">
            {mode === 'login'
              ? 'Choose the kind of account you hold, then sign in.'
              : 'Members and community leaders can register directly.'}
          </p>

          {/* role selector */}
          <div
            role="tablist"
            aria-label="Account type"
            className="mt-7 grid grid-cols-3 gap-1 rounded-xl border border-tide-100 bg-white p-1 shadow-lift"
          >
            {ROLES.map((r) => (
              <button
                key={r.id}
                role="tab"
                type="button"
                aria-selected={r.id === role}
                onClick={() => { setRole(r.id); setError(''); }}
                className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2 py-2.5
                  text-[13px] font-semibold transition duration-200
                  ${r.id === role
                    ? 'bg-tide-600 text-white shadow-[0_8px_20px_-12px_rgba(5,150,105,0.95)]'
                    : 'text-slate-500 hover:bg-tide-50 hover:text-abyss-900'}`}
              >
                <r.icon size={15} aria-hidden />
                {r.label}
              </button>
            ))}
          </div>

          <p
            className="mt-3 flex gap-2 rounded-xl bg-white px-3.5 py-3 text-[12px] leading-relaxed
                       text-slate-600 shadow-lift"
            aria-live="polite"
          >
            <active.icon size={14} className="mt-0.5 shrink-0 text-tide-600" aria-hidden />
            {active.blurb}
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === 'register' && (
              <>
                <IconField
                  icon={UserRound}
                  label="Full name"
                  required
                  autoComplete="name"
                  value={form.fullName}
                  onChange={set('fullName')}
                  placeholder="Aparna Das"
                />
                <IconField
                  icon={AtSign}
                  label="Email"
                  type="email"
                  required
                  autoComplete="email"
                  value={form.email}
                  onChange={set('email')}
                  placeholder="you@example.in"
                />
                <div className="grid grid-cols-2 gap-4">
                  <IconField
                    icon={Phone}
                    label="Phone"
                    type="tel"
                    autoComplete="tel"
                    value={form.phone}
                    onChange={set('phone')}
                    placeholder="+91 90000 00000"
                  />
                  <IconField
                    icon={MapPin}
                    label="Village"
                    value={form.village}
                    onChange={set('village')}
                    placeholder="Gosaba"
                  />
                </div>
              </>
            )}

            <IconField
              icon={User}
              label={mode === 'login' ? 'Username or email' : 'Username'}
              required
              autoComplete="username"
              value={form.username}
              onChange={set('username')}
              placeholder={mode === 'register' ? 'aparna.d' : ''}
              hint={
                mode === 'register'
                  ? 'Your leader searches for you by this, so keep it simple — letters, numbers, dots.'
                  : undefined
              }
            />

            <IconField
              icon={mode === 'login' ? Lock : KeyRound}
              label="Password"
              required
              type={showPassword ? 'text' : 'password'}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={form.password}
              onChange={set('password')}
              hint={mode === 'register' ? 'At least 8 characters.' : undefined}
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer rounded-md p-1
                             text-slate-400 transition hover:bg-slate-100 hover:text-abyss-900"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              }
            />

            {error && (
              <p
                role="alert"
                className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs leading-relaxed text-rose-700"
              >
                {error}
              </p>
            )}

            <button type="submit" className="btn-primary w-full !py-3 text-[15px]" disabled={busy}>
              {busy && <Loader2 size={16} className="animate-spin" aria-hidden />}
              {mode === 'login' ? 'Sign in' : `Create ${active.label.toLowerCase()} account`}
            </button>
          </form>

          {role === 'admin' ? (
            <p className="mt-5 flex gap-2 rounded-xl border border-tide-100 bg-white px-4 py-3 text-xs leading-relaxed text-slate-500">
              <Landmark size={14} className="mt-0.5 shrink-0 text-tide-600" aria-hidden />
              Government accounts are provisioned by the registry office and cannot be created here.
            </p>
          ) : (
            <p className="mt-6 text-center text-sm text-slate-500">
              {mode === 'login' ? 'New to the registry?' : 'Already registered?'}{' '}
              <button
                type="button"
                onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
                className="cursor-pointer font-semibold text-tide-700 underline-offset-4 hover:underline"
              >
                {mode === 'login' ? 'Create an account' : 'Sign in instead'}
              </button>
            </p>
          )}

          <p className="mt-8 text-center">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 transition hover:text-tide-700"
            >
              <ArrowLeft size={13} aria-hidden />
              Back to the programme page
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}

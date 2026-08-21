import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { GeoJSON } from 'react-leaflet';
import {
  ArrowRight, BadgeCheck, CalendarCheck, Camera, ChevronDown, FileCheck2, Gauge, Landmark,
  Leaf, MapPin, Menu, Ruler, ShieldCheck, Sprout, Users, Waves, X,
} from 'lucide-react';
import MapCanvas, { FitTo } from '../components/MapCanvas.jsx';
import CheckoutDialog from '../components/CheckoutDialog.jsx';
import { Logo } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { ECOSYSTEM_META, dateLabel, money, num } from '../lib/format.js';

/* ------------------------------------------------------------------ sections */

const NAV_LINKS = [
  ['How it works', '#how'],
  ['Verification', '#verification'],
  ['Marketplace', '#marketplace'],
];

function Nav() {
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // The mobile sheet is the only place links and the sign-in action sit together.
  const opaque = solid || open;

  return (
    <header
      className={`fixed inset-x-0 top-0 z-[600] transition-all duration-300
        ${opaque ? 'border-b border-tide-100 bg-white/95 backdrop-blur-xl' : 'border-b border-transparent'}`}
    >
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-5 py-3.5">
        <Link to="/" className={opaque ? 'text-abyss-900' : 'text-white'} aria-label="Blue Carbon Registry home">
          <Logo />
        </Link>

        <nav className="ml-auto hidden items-center gap-1 md:flex" aria-label="Page sections">
          {NAV_LINKS.map(([label, href]) => (
            <a
              key={href}
              href={href}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition
                ${opaque ? 'text-slate-600 hover:bg-tide-50 hover:text-abyss-900'
                         : 'text-white/80 hover:bg-white/10 hover:text-white'}`}
            >
              {label}
            </a>
          ))}
        </nav>

        <Link
          to="/login"
          className={`btn ml-3 hidden md:inline-flex
            ${opaque ? 'btn-light' : 'border border-white/25 bg-white/10 text-white hover:bg-white/20'}`}
        >
          Sign in
        </Link>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? 'Close menu' : 'Open menu'}
          className={`ml-auto cursor-pointer rounded-lg p-2 transition md:hidden
            ${opaque ? 'text-abyss-900 hover:bg-tide-50' : 'text-white hover:bg-white/10'}`}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {open && (
        <div className="animate-rise border-t border-tide-100 bg-white px-5 pb-5 pt-2 md:hidden">
          <nav className="flex flex-col" aria-label="Page sections">
            {NAV_LINKS.map(([label, href]) => (
              <a
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-3 text-sm font-medium text-slate-700 transition hover:bg-tide-50"
              >
                {label}
              </a>
            ))}
          </nav>
          <Link to="/login" className="btn-primary mt-3 w-full" onClick={() => setOpen(false)}>
            Sign in
          </Link>
        </div>
      )}
    </header>
  );
}

function Hero({ impact }) {
  const boundaries = useMemo(
    () => impact?.projects?.map((p) => p.boundary).filter(Boolean) ?? [],
    [impact]
  );

  return (
    <section className="relative isolate overflow-hidden bg-abyss-950 pb-20 pt-32 text-white sm:pb-28 sm:pt-40">
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          backgroundImage:
            'radial-gradient(1100px 620px at 8% -10%, rgba(16,185,129,0.30), transparent 62%),' +
            'radial-gradient(900px 560px at 88% 8%, rgba(34,211,238,0.20), transparent 60%),' +
            'linear-gradient(180deg, #04151A 0%, #062229 55%, #04151A 100%)',
        }}
      />
      <svg
        aria-hidden
        className="absolute inset-x-0 bottom-0 -z-10 h-40 w-full text-sand"
        viewBox="0 0 1440 160"
        preserveAspectRatio="none"
      >
        <path
          d="M0 96c180-52 320 24 520 24s340-72 520-72 260 44 400 44v68H0Z"
          fill="currentColor"
          opacity="0.98"
        />
      </svg>

      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 lg:grid-cols-[1.05fr_1fr]">
        <div className="animate-rise">
          <span className="inline-flex items-center gap-2 rounded-full border border-tide-400/30 bg-tide-400/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-tide-300">
            <Waves size={13} aria-hidden />
            National coastal restoration programme
          </span>

          <h1 className="mt-6 text-4xl font-bold leading-[1.06] tracking-tight sm:text-[52px]">
            The coast stores the carbon.
            <span className="block bg-gradient-to-r from-tide-300 via-tide-200 to-cyan-300 bg-clip-text text-transparent">
              The village should earn from it.
            </span>
          </h1>

          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-slate-300">
            Coastal communities register unused tidal land, receive saplings and equipment from
            the state, and restore it parcel by parcel. Every household logs a photo and sensor
            readings each day — that evidence becomes verified blue carbon, sold openly here, with
            the proceeds returning to the people who did the planting.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-3">
            <Link to="/login?tab=leader" className="btn-primary !px-5 !py-3 text-[15px]">
              Register your community
              <ArrowRight size={17} aria-hidden />
            </Link>
            <a
              href="#marketplace"
              className="group inline-flex items-center gap-1.5 text-[15px] font-medium text-slate-300
                         underline-offset-4 transition hover:text-white hover:underline"
            >
              Buying credits instead?
              <ArrowRight size={15} className="transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
            </a>
          </div>

          <p className="mt-5 flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck size={14} className="text-tide-400" aria-hidden />
            Every parcel is surveyed on the ground by a government officer before it is registered.
          </p>
        </div>

        <div className="animate-rise [animation-delay:120ms]">
          <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-2.5 shadow-panel backdrop-blur">
            <MapCanvas
              className="h-[380px] sm:h-[440px]"
              basemap="satellite"
              center={[21.9, 88.6]}
              zoom={12}
              legend={
                <span className="flex items-center gap-2 text-[11px] text-slate-300">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-tide-400 opacity-75 animate-ring" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-tide-300" />
                  </span>
                  {impact ? `${impact.stats.projects} registered sites` : 'Loading registry…'}
                </span>
              }
            >
              {boundaries.map((geometry, i) => (
                <GeoJSON
                  key={i}
                  data={geometry}
                  style={{ color: '#34D399', weight: 2, fillColor: '#10B981', fillOpacity: 0.28 }}
                />
              ))}
              {boundaries[0] && <FitTo geometry={boundaries[0]} maxZoom={14} />}
            </MapCanvas>
          </div>
          <p className="mt-3 px-1 text-[11px] text-slate-500">
            Live registry boundaries · Imagery © Esri, Maxar
          </p>
        </div>
      </div>
    </section>
  );
}

function ImpactBar({ impact }) {
  const items = [
    ['Hectares under restoration', num(impact?.stats.hectares, 1), Ruler],
    ['Households enrolled', num(impact?.stats.people), Users],
    ['Saplings logged', num(impact?.stats.saplings), Sprout],
    ['tCO₂e retired by buyers', num(impact?.stats.tonnes_retired, 1), BadgeCheck],
  ];

  return (
    <section className="mx-auto -mt-10 max-w-6xl px-5">
      <dl className="grid gap-px overflow-hidden rounded-2xl bg-tide-100 shadow-lift sm:grid-cols-2 lg:grid-cols-4">
        {items.map(([label, value, Icon]) => (
          <div key={label} className="bg-white px-5 py-6">
            <Icon size={17} className="text-tide-600" aria-hidden />
            <dd className="tabular mt-3 text-[28px] font-semibold leading-none text-abyss-900">{value}</dd>
            <dt className="mt-2 text-xs font-medium text-slate-500">{label}</dt>
          </div>
        ))}
      </dl>
    </section>
  );
}

function WhyBlueCarbon() {
  const bars = [
    ['Mangrove forest', 100, '#059669'],
    ['Salt marsh', 78, '#0E9488'],
    ['Seagrass meadow', 62, '#0891B2'],
    ['Tropical rainforest', 24, '#94A3B8'],
  ];

  return (
    <section className="mx-auto max-w-6xl px-5 py-24">
      <div className="grid items-center gap-14 lg:grid-cols-2">
        <div>
          <p className="label !text-tide-700">Why the coast</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-abyss-900 sm:text-[38px]">
            A hectare of mangrove buries carbon four times faster than rainforest.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-slate-600">
            Tidal soils are waterlogged and airless, so leaf litter and roots never fully decay.
            Carbon accumulates in the mud for centuries. India has thousands of hectares of
            degraded tidal flat sitting unused beside villages that need income — the two problems
            solve each other.
          </p>

          <ul className="mt-7 space-y-3.5">
            {[
              [Leaf, 'Long-lived storage', 'Sediment carbon stays locked away for centuries, not decades.'],
              [ShieldCheck, 'Coastal protection', 'Restored belts blunt storm surge and slow erosion behind them.'],
              [Landmark, 'Direct income', 'Sale proceeds are split by verified daily stewardship, not by land title.'],
            ].map(([Icon, title, copy]) => (
              <li key={title} className="flex gap-3.5">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-tide-50 text-tide-700">
                  <Icon size={16} aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-semibold text-abyss-900">{title}</p>
                  <p className="text-sm leading-relaxed text-slate-600">{copy}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="card p-7">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Relative carbon burial rate per hectare each year
          </p>
          <div className="mt-6 space-y-5">
            {bars.map(([label, value, color]) => (
              <div key={label}>
                <div className="mb-1.5 flex items-baseline justify-between">
                  <span className="text-sm font-medium text-abyss-900">{label}</span>
                  <span className="tabular text-xs text-slate-500">{value}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full transition-[width] duration-1000"
                    style={{ width: `${value}%`, background: color }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-6 border-t border-tide-100 pt-4 text-[11px] leading-relaxed text-slate-500">
            Indexed to mangrove soil burial. Registry projects are credited at
            {' '}{ECOSYSTEM_META.mangrove.rate} tCO₂e per hectare per year for mangrove,
            {' '}{ECOSYSTEM_META.saltmarsh.rate} for salt marsh and {ECOSYSTEM_META.seagrass.rate} for
            seagrass, then discounted by measured community participation.
          </p>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      role: 'Community leader',
      icon: Users,
      title: 'Form the collective and apply',
      copy: 'The leader creates an account, searches members by username and sends join requests — up to 25 households. Once they accept, the leader traces the unused coastal area on the map and applies.',
    },
    {
      role: 'Government officer',
      icon: MapPin,
      title: 'Ground survey and approval',
      copy: 'Officers visit the site in person, confirm the land is genuinely unused, hand over saplings and instruments, then trace the surveyed boundary in the registry and approve it.',
    },
    {
      role: 'Registry',
      icon: Ruler,
      title: 'The area splits into parcels',
      copy: 'The approved boundary is divided into equal parcels — one per member — and each parcel is assigned automatically. Members see only their own patch on the map.',
    },
    {
      role: 'Every member, daily',
      icon: Camera,
      title: 'Plant, water, photograph, record',
      copy: 'Each day a member uploads a photo of their parcel and enters temperature, humidity and soil moisture. A complete entry earns one stewardship credit.',
    },
    {
      role: 'Community leader',
      icon: Gauge,
      title: 'Chase the gaps',
      copy: 'The leader sees which parcels reported and which did not, and follows up in person. Their own credit is the day’s participation rate times two — if 8 of 10 report, they earn 1.6.',
    },
    {
      role: 'After two years',
      icon: BadgeCheck,
      title: 'Verified tonnes reach the market',
      copy: 'Accumulated carbon is listed publicly. Buyers purchase without an account, and the money is shared among the community in proportion to the credits each person earned.',
    },
  ];

  return (
    <section id="how" className="scroll-mt-20 bg-abyss-950 py-24 text-white">
      <div className="mx-auto max-w-6xl px-5">
        <div className="max-w-2xl">
          <p className="label !text-tide-400">End to end</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-[38px]">
            From unused mudflat to a credit someone can buy.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-slate-400">
            Six steps, three kinds of account, one shared record. Nothing enters the registry that
            a government officer has not stood on.
          </p>
        </div>

        <ol className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {steps.map((step, i) => (
            <li
              key={step.title}
              className="panel group relative p-6 transition duration-300 hover:border-tide-400/30 hover:bg-white/[0.07]"
            >
              <div className="flex items-center justify-between">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-tide-500/15 text-tide-300 ring-1 ring-inset ring-tide-400/25">
                  <step.icon size={17} aria-hidden />
                </span>
                <span className="tabular text-[28px] font-semibold leading-none text-white/8">
                  {String(i + 1).padStart(2, '0')}
                </span>
              </div>
              <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-tide-400">
                {step.role}
              </p>
              <h3 className="mt-1.5 text-[17px] font-semibold tracking-tight">{step.title}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-slate-400">{step.copy}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const EVIDENCE = [
  {
    icon: Camera,
    title: 'A dated photo',
    copy: 'One photograph of the parcel, uploaded the same day it was taken. Missed days cannot be back-filled.',
  },
  {
    icon: Gauge,
    title: 'Three readings',
    copy: 'Temperature, relative humidity and soil moisture, entered by hand from the meters issued at the site visit.',
  },
  {
    icon: CalendarCheck,
    title: 'One credit',
    copy: 'A complete entry earns the member exactly one stewardship credit. An incomplete one earns nothing.',
  },
  {
    icon: FileCheck2,
    title: 'A discounted tonne',
    copy: 'Modelled carbon is cut to match the community\u2019s real reporting rate before any of it can be sold.',
  },
];

/** Ten squares, eight filled - the worked example made visible. */
function ParticipationDots({ total = 10, filled = 8 }) {
  return (
    <div
      className="flex flex-wrap gap-1.5"
      role="img"
      aria-label={`${filled} of ${total} parcels reported`}
    >
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-6 w-6 rounded-md border
            ${i < filled
              ? 'border-tide-600 bg-tide-500'
              : 'border-dashed border-amber-400 bg-amber-400/10'}`}
        />
      ))}
    </div>
  );
}

function Verification() {
  return (
    <section id="verification" className="scroll-mt-20 bg-white py-24">
      <div className="mx-auto max-w-6xl px-5">
        <div className="max-w-3xl">
          <p className="label !text-tide-700">Measurement, reporting, verification</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-abyss-900 sm:text-[38px]">
            A credit is a day of proven work, not a promise.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-slate-600">
            The registry does not estimate effort &mdash; it records it. Carbon accrues on the
            surveyed area at the published rate for its ecosystem, then that figure is discounted
            by the community&apos;s measured participation over the life of the project. A community
            that reports on 84% of days sells 84% of the modelled tonnes.
          </p>
        </div>

        {/* the chain of evidence, as one connected strip */}
        <ol className="mt-14 grid gap-px overflow-hidden rounded-2xl bg-tide-100 shadow-lift sm:grid-cols-2 lg:grid-cols-4">
          {EVIDENCE.map((item, i) => (
            <li key={item.title} className="bg-white p-6">
              <div className="flex items-center justify-between">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-tide-50 text-tide-700">
                  <item.icon size={17} aria-hidden />
                </span>
                <span className="tabular text-[26px] font-semibold leading-none text-tide-100">
                  {String(i + 1).padStart(2, '0')}
                </span>
              </div>
              <h3 className="mt-5 text-[15px] font-semibold text-abyss-900">{item.title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-600">{item.copy}</p>
            </li>
          ))}
        </ol>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {/* worked example */}
          <div className="card p-7">
            <div className="flex items-baseline justify-between gap-4">
              <h3 className="text-[15px] font-semibold text-abyss-900">How one day is credited</h3>
              <span className="text-[11px] text-slate-400">10-household collective</span>
            </div>

            <div className="mt-6">
              <ParticipationDots />
              <p className="mt-3 text-xs text-slate-500">
                <span className="font-semibold text-abyss-900">8 of 10</span> parcels filed a
                complete entry. The two dashed squares earned nothing.
              </p>
            </div>

            <dl className="mt-6 space-y-px overflow-hidden rounded-xl bg-tide-100">
              {[
                ['Each reporting member', '1.00 \u00d7 8', '8.00'],
                ['Community leader', '2.00 \u00d7 80%', '1.60'],
              ].map(([who, calc, out]) => (
                <div key={who} className="flex items-center justify-between gap-4 bg-white px-4 py-3">
                  <dt className="text-xs text-slate-600">{who}</dt>
                  <dd className="flex items-baseline gap-3">
                    <span className="tabular text-[11px] text-slate-400">{calc}</span>
                    <span className="tabular w-12 text-right text-sm font-semibold text-abyss-900">{out}</span>
                  </dd>
                </div>
              ))}
              <div className="flex items-center justify-between gap-4 bg-tide-50 px-4 py-3">
                <dt className="text-xs font-semibold text-abyss-900">Credits created that day</dt>
                <dd className="tabular text-lg font-semibold text-tide-800">9.60</dd>
              </div>
            </dl>

            <p className="mt-5 text-xs leading-relaxed text-slate-500">
              The leader is paid on the whole community&apos;s reliability, which is why chasing
              those two missing parcels is their job and not the registry&apos;s.
            </p>
          </div>

          {/* the formula */}
          <div className="relative isolate overflow-hidden rounded-2xl bg-abyss-950 p-7 text-white">
            <div
              aria-hidden
              className="absolute inset-0 -z-10"
              style={{
                backgroundImage:
                  'radial-gradient(600px 340px at 85% 0%, rgba(16,185,129,0.22), transparent 62%)',
              }}
            />
            <h3 className="text-[15px] font-semibold">What the buyer actually gets</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-slate-400">
              Every tonne on the marketplace comes out of this one calculation. No adjustments,
              no discretion.
            </p>

            <div className="mt-7 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ['Area', '140.8', 'hectares surveyed'],
                ['Rate', '6.5', 'tCO\u2082e / ha / yr'],
                ['Time', '2.0', 'years elapsed'],
                ['Reporting', '84%', 'of days filed'],
              ].map(([k, v, note]) => (
                <div key={k} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3.5 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">{k}</p>
                  <p className="tabular mt-1.5 text-base font-semibold text-tide-300">{v}</p>
                  <p className="mt-1 text-[10px] leading-tight text-slate-500">{note}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 flex items-center justify-between gap-4 rounded-xl border border-tide-400/25 bg-tide-500/10 px-4 py-4">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-tide-300">Sellable this vintage</p>
                <p className="tabular mt-1 text-[11px] text-slate-400">140.8 &times; 6.5 &times; 2.0 &times; 0.84</p>
              </div>
              <p className="tabular shrink-0 text-2xl font-semibold text-tide-200">
                1,538 <span className="text-xs font-medium text-slate-400">tCO&#8322;e</span>
              </p>
            </div>

            <ul className="mt-6 space-y-2.5">
              {[
                'The boundary is the one an officer walked and traced, not the one applied for.',
                'Participation is computed from filed entries, so it cannot be talked up.',
                'Retired serials are cancelled in the registry and can never be resold.',
              ].map((line) => (
                <li key={line} className="flex gap-2.5 text-[12px] leading-relaxed text-slate-400">
                  <ShieldCheck size={14} className="mt-0.5 shrink-0 text-tide-400" aria-hidden />
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function ListingCard({ listing, onBuy }) {
  const remaining = Number(listing.tonnes_remaining);
  const sold = Number(listing.tonnes_sold);
  const progress = listing.tonnes_available ? sold / Number(listing.tonnes_available) : 0;

  return (
    <article className="card group flex flex-col overflow-hidden transition duration-300 hover:-translate-y-0.5 hover:shadow-xl">
      <div className="relative h-40">
        <MapCanvas
          className="!rounded-none h-full !border-0"
          basemap="satellite"
          showSwitcher={false}
          zoom={13}
        >
          <GeoJSON
            data={listing.boundary}
            style={{ color: '#34D399', weight: 2, fillColor: '#10B981', fillOpacity: 0.3 }}
          />
          <FitTo geometry={listing.boundary} padding={18} maxZoom={15} />
        </MapCanvas>
        <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-abyss-950/80 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-tide-300 backdrop-blur">
          {listing.project_code}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-[15px] font-semibold leading-snug text-abyss-900">{listing.project_name}</h3>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
          <MapPin size={12} aria-hidden />
          {listing.community_name} · {listing.district}, {listing.state}
        </p>

        <dl className="mt-4 grid grid-cols-3 gap-3 border-y border-tide-100 py-3.5">
          {[
            ['Area', `${num(listing.area_hectares, 1)} ha`],
            ['Parcels', num(listing.parcels)],
            ['Vintage', listing.vintage_year],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-[10px] uppercase tracking-wider text-slate-400">{k}</dt>
              <dd className="tabular mt-0.5 text-sm font-semibold text-abyss-900">{v}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-4">
          <div className="mb-1.5 flex items-baseline justify-between text-xs">
            <span className="text-slate-500">{num(remaining, 1)} tCO₂e available</span>
            <span className="tabular font-semibold text-tide-700">
              {ECOSYSTEM_META[listing.ecosystem]?.label ?? listing.ecosystem}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-tide-600 to-tide-400"
              style={{ width: `${Math.min(100, progress * 100)}%` }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-slate-400">
            {num(sold, 1)} t already retired · started {dateLabel(listing.start_date)}
          </p>
        </div>

        <div className="mt-5 flex items-end justify-between gap-3">
          <p>
            <span className="tabular text-2xl font-semibold text-abyss-900">
              {money(listing.price_per_tonne)}
            </span>
            <span className="text-xs text-slate-500"> / tCO₂e</span>
          </p>
          <button type="button" className="btn-primary" onClick={() => onBuy(listing)}>
            Buy credits
          </button>
        </div>
      </div>
    </article>
  );
}

function Marketplace({ listings, pricing, loading, onBought }) {
  const [checkout, setCheckout] = useState(null);

  return (
    <section id="marketplace" className="scroll-mt-20 bg-sand py-24">
      <div className="mx-auto max-w-6xl px-5">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <p className="label !text-tide-700">Marketplace</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-abyss-900 sm:text-[38px]">
              Buy verified removals directly from the village that grew them.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-slate-600">
              No account, no broker, no minimum order. Fill in your details, pay, and receive a
              retirement certificate tied to a named community and a mapped boundary.
            </p>
          </div>
          <p className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck size={15} className="text-tide-600" aria-hidden />
            Every listing is government-surveyed and serial-numbered
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {loading &&
            [0, 1, 2].map((i) => (
              <div key={i} className="card h-[420px] animate-pulse bg-slate-50" aria-hidden />
            ))}

          {!loading && listings.length === 0 && (
            <div className="card col-span-full px-6 py-16 text-center">
              <Sprout size={22} className="mx-auto text-tide-600" aria-hidden />
              <p className="mt-3 text-sm font-semibold text-abyss-900">No lots on the market yet</p>
              <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-slate-500">
                Projects list their verified tonnes once the registry office releases them. Check
                back, or register your own community to start accruing.
              </p>
            </div>
          )}

          {listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} onBuy={setCheckout} />
          ))}
        </div>
      </div>

      {checkout && (
        <CheckoutDialog
          listing={checkout}
          pricing={pricing}
          onClose={() => setCheckout(null)}
          onComplete={onBought}
        />
      )}
    </section>
  );
}

function Faq() {
  const items = [
    ['Who can register a community?',
      'Any resident who can bring together up to 25 households next to unused coastal land. The leader creates a leader account; each household creates a member account and accepts the invitation.'],
    ['What if we do not own the land?',
      'Blue carbon parcels are typically on commons or degraded government land. The site visit establishes that the area is unused and that the community is the legitimate steward — payouts follow verified work, not land title.'],
    ['What happens if someone misses a day?',
      'That member simply earns nothing for the day, and the leader sees the gap immediately and follows up. Persistent gaps lower the community’s participation rate, which lowers the tonnes the project can sell.'],
    ['When does the money arrive?',
      'Projects run for two years before their accumulated tonnes are listed. Sale proceeds are divided across every credit earned, so a household that reported on 600 days receives twice what one that reported on 300 days does.'],
    ['What exactly happens when I buy?',
      'Your payment is authorised and captured, the volume is reserved against that lot, serial numbers are assigned from the project’s block, the credits are transferred to you and then retired — permanently cancelled so they cannot be resold or counted twice. You receive a certificate carrying the serial range, the project code and the retirement date. Payment itself runs against a demo gateway here; connecting Razorpay or Stripe is a single route change on the server.'],
  ];
  const [open, setOpen] = useState(0);

  return (
    <section className="bg-white">
      <div className="mx-auto max-w-3xl px-5 py-24">
      <h2 className="text-3xl font-bold tracking-tight text-abyss-900">Common questions</h2>
      <div className="mt-8 divide-y divide-tide-100 border-y border-tide-100">
        {items.map(([q, a], i) => (
          <div key={q}>
            <button
              type="button"
              onClick={() => setOpen(open === i ? -1 : i)}
              aria-expanded={open === i}
              className="flex w-full cursor-pointer items-center justify-between gap-4 py-4 text-left"
            >
              <span className="text-[15px] font-medium text-abyss-900">{q}</span>
              <ChevronDown
                size={17}
                className={`shrink-0 text-tide-600 transition-transform duration-300 ${open === i ? 'rotate-180' : ''}`}
                aria-hidden
              />
            </button>
            {open === i && (
              <p className="animate-rise pb-5 pr-8 text-sm leading-relaxed text-slate-600">{a}</p>
            )}
          </div>
        ))}
      </div>
      </div>
    </section>
  );
}

function ClosingCta() {
  return (
    <section className="bg-sand pb-24 pt-4">
      <div className="mx-auto max-w-6xl px-5">
        <div className="overflow-hidden rounded-[22px] border border-tide-200 bg-tide-50">
          <div className="grid items-center gap-10 p-9 sm:p-12 lg:grid-cols-[1.3fr_1fr]">
            <div>
              <p className="label !text-tide-700">For coastal communities</p>
              <h2 className="mt-3 text-3xl font-bold leading-tight tracking-tight text-abyss-900 sm:text-[34px]">
                Is there tidal land beside your village that no one is using?
              </h2>
              <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-slate-600">
                Bring together up to 25 households, trace the area on a map, and apply. An officer
                visits, supplies the saplings and meters, and the parcels are yours to restore
                &mdash; with every day of work recorded in your name.
              </p>
              <Link to="/login?tab=leader" className="btn-primary mt-8 !px-5 !py-3 text-[15px]">
                Register your community
                <ArrowRight size={17} aria-hidden />
              </Link>
            </div>

            <ul className="space-y-3 border-t border-tide-200 pt-8 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
              {[
                [Users, 'Up to 25 households', 'One parcel each, assigned automatically on approval.'],
                [Sprout, 'Saplings and meters supplied', 'Handed over by the officer at the site visit.'],
                [BadgeCheck, 'No land title needed', 'Payouts follow verified daily work, not ownership.'],
              ].map(([Icon, title, copy]) => (
                <li key={title} className="flex gap-3.5">
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-tide-700">
                    <Icon size={16} aria-hidden />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-abyss-900">{title}</p>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-slate-600">{copy}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

const FOOTER_COLUMNS = [
  ['Programme', NAV_LINKS.map(([label, href]) => [label, href, false])],
  ['Sign in', [
    ['Community leader', '/login?tab=leader', true],
    ['Community member', '/login?tab=member', true],
    ['Government officer', '/login?tab=admin', true],
  ]],
  ['Buyers', [
    ['Browse open lots', '#marketplace', false],
    ['How a credit is verified', '#verification', false],
    ['What a certificate shows', '#verification', false],
  ]],
];

function Footer() {
  return (
    <footer className="bg-abyss-950 text-white">
      <div className="mx-auto max-w-6xl px-5 py-16">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-[1.5fr_repeat(3,1fr)]">
          <div className="max-w-sm">
            <Logo dark />
            <p className="mt-5 text-sm leading-relaxed text-slate-400">
              A shared record of coastal restoration &mdash; held by the government, worked by the
              community, open to any buyer.
            </p>
            <p className="mt-5 flex items-start gap-2 text-xs leading-relaxed text-slate-500">
              <ShieldCheck size={14} className="mt-0.5 shrink-0 text-tide-400" aria-hidden />
              Every project on this registry was surveyed on the ground before it was approved.
            </p>
          </div>

          {FOOTER_COLUMNS.map(([heading, items]) => (
            <nav key={heading} aria-label={heading}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                {heading}
              </p>
              <ul className="mt-4 space-y-2.5">
                {items.map(([label, href, isRoute]) => (
                  <li key={label + href}>
                    {isRoute ? (
                      <Link to={href} className="text-sm text-slate-400 transition hover:text-tide-300">
                        {label}
                      </Link>
                    ) : (
                      <a href={href} className="text-sm text-slate-400 transition hover:text-tide-300">
                        {label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-14 flex flex-wrap items-center justify-between gap-x-8 gap-y-3 border-t border-white/10 pt-7 text-[11px] text-slate-500">
          <p>Blue Carbon Registry &middot; demonstration deployment</p>
          <p>Basemaps &copy; OpenStreetMap contributors, CARTO, Esri</p>
        </div>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------- page */

export default function Landing() {
  const [impact, setImpact] = useState(null);
  const [listings, setListings] = useState([]);
  const [pricing, setPricing] = useState(undefined);
  const [loading, setLoading] = useState(true);

  const loadListings = () =>
    api.get('/market/listings')
      .then(({ listings: l, pricing: p }) => {
        setListings(l);
        if (p) setPricing(p);
      })
      .catch(() => setListings([]));

  useEffect(() => {
    Promise.all([
      api.get('/market/impact').then(setImpact).catch(() => setImpact(null)),
      loadListings(),
    ]).finally(() => setLoading(false));
  }, []);

  return (
    <div className="bg-sand">
      <Nav />
      <Hero impact={impact} />
      <ImpactBar impact={impact} />
      <WhyBlueCarbon />
      <HowItWorks />
      <Verification />
      <Marketplace listings={listings} pricing={pricing} loading={loading} onBought={loadListings} />
      <Faq />
      <ClosingCta />
      <Footer />
    </div>
  );
}

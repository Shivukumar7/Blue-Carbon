import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis,
} from 'recharts';
import {
  AlertCircle, CalendarDays, ChevronLeft, ChevronRight, Coins, FileCheck2, Gauge, Leaf,
  Loader2, MapIcon, Phone, Search, Send, Trash2, TrendingUp, UserPlus, Users, X,
} from 'lucide-react';
import AppShell, { PageHead } from '../components/AppShell.jsx';
import MapCanvas, { FitTo, LegendRow } from '../components/MapCanvas.jsx';
import ParcelLayer, { BoundaryLayer, PARCEL_COLORS } from '../components/ParcelLayer.jsx';
import AreaDrawer, { DrawToolbar } from '../components/AreaDrawer.jsx';
import { Alert, Badge, EmptyState, Meter, Panel, Spinner, Stat } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { areaHectares } from '../lib/geo.js';
import {
  ECOSYSTEM_META, STATUS_META, dateLabel, num, pct, shiftISO, shortDate, timeLabel, todayISO,
} from '../lib/format.js';

const MAX_MEMBERS = 25;

/* ------------------------------------------------------- community setup */

function CreateCommunity({ onCreated }) {
  const [form, setForm] = useState({ name: '', district: '', state: '', description: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post('/communities', form);
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Create your community">
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm leading-relaxed text-slate-400">
          Name the collective that will work this coastline. You can add up to {MAX_MEMBERS}
          {' '}households once it exists.
        </p>
        <label className="block">
          <span className="label mb-1.5 block">Community name *</span>
          <input required className="field" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Gosaba Tidal Collective" />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="label mb-1.5 block">District</span>
            <input className="field" value={form.district}
              onChange={(e) => setForm({ ...form, district: e.target.value })} />
          </label>
          <label className="block">
            <span className="label mb-1.5 block">State</span>
            <input className="field" value={form.state}
              onChange={(e) => setForm({ ...form, state: e.target.value })} />
          </label>
        </div>
        <label className="block">
          <span className="label mb-1.5 block">About the community</span>
          <textarea rows={3} className="field resize-none" value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Who you are, and which stretch of coast you want to restore." />
        </label>
        {error && <Alert kind="error">{error}</Alert>}
        <button className="btn-primary w-full !py-3" disabled={busy}>
          {busy && <Loader2 size={15} className="animate-spin" aria-hidden />}
          Create community
        </button>
      </form>
    </Panel>
  );
}

function MemberSearch({ disabled, onInvited }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return undefined; }
    const t = setTimeout(() => {
      api.get(`/communities/search-members?q=${encodeURIComponent(q.trim())}`)
        .then(({ results: r }) => setResults(r))
        .catch(() => setResults([]));
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  async function invite(user) {
    setBusy(user.id);
    setError('');
    try {
      await api.post('/communities/invite', { userId: user.id });
      setQ('');
      setResults([]);
      onInvited();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="relative">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden />
        <input
          className="field pl-9"
          placeholder="Search members by username or name…"
          value={q}
          disabled={disabled}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search for community members"
        />
      </div>

      {disabled && (
        <p className="mt-2 text-xs text-slate-500">
          The roster is locked once the application has been submitted.
        </p>
      )}
      {error && <div className="mt-3"><Alert kind="error">{error}</Alert></div>}

      {results.length > 0 && (
        <ul className="mt-3 divide-y divide-white/8 overflow-hidden rounded-xl border border-white/10 bg-abyss-900/60">
          {results.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-4 py-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-tide-500/15 text-xs font-semibold text-tide-300">
                {r.full_name.slice(0, 1)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-100">{r.full_name}</p>
                <p className="truncate text-xs text-slate-500">@{r.username}{r.village ? ` · ${r.village}` : ''}</p>
              </div>
              {r.unavailable ? (
                <Badge tone="slate">Already in a community</Badge>
              ) : (
                <button type="button" className="btn-primary !px-3 !py-1.5 text-xs"
                  onClick={() => invite(r)} disabled={busy === r.id}>
                  {busy === r.id ? <Loader2 size={13} className="animate-spin" aria-hidden />
                    : <Send size={13} aria-hidden />}
                  Send request
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {q.trim().length >= 2 && results.length === 0 && (
        <p className="mt-3 text-xs text-slate-500">
          No member accounts match “{q.trim()}”. Ask them to register first — they need a member
          account before you can add them.
        </p>
      )}
    </div>
  );
}

function ApplyPanel({ roster, onApplied }) {
  const [map, setMap] = useState(null);
  const [area, setArea] = useState(null);
  const [form, setForm] = useState({ title: '', ecosystem: 'mangrove', notes: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const active = roster.filter((r) => r.status === 'active').length;
  const ha = area ? areaHectares(area) : 0;

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!area) return setError('Trace the coastal area you are applying for on the map.');
    setBusy(true);
    try {
      await api.post('/applications', { ...form, area });
      onApplied();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Apply for the restoration programme">
      <form onSubmit={submit} className="space-y-5">
        <p className="text-sm leading-relaxed text-slate-400">
          Trace the unused coastal land your community wants to restore. A government officer will
          visit the site before anything is approved, and will redraw the boundary from their own
          survey if it differs.
        </p>

        <MapCanvas className="h-[380px]" basemap="satellite" center={[21.9, 88.6]} zoom={13} mapRef={setMap}>
          <AreaDrawer value={area} onChange={setArea} />
        </MapCanvas>

        <DrawToolbar
          map={map}
          value={area}
          onChange={setArea}
          hint="Click to place each corner, then click the first point again to close the shape. Drag any point to adjust it."
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="label mb-1.5 block">Project name *</span>
            <input required className="field" value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Bidya East mangrove restoration" />
          </label>
          <label className="block">
            <span className="label mb-1.5 block">Ecosystem *</span>
            <select className="field cursor-pointer" value={form.ecosystem}
              onChange={(e) => setForm({ ...form, ecosystem: e.target.value })}>
              {Object.entries(ECOSYSTEM_META).map(([key, meta]) => (
                <option key={key} value={key} className="bg-abyss-900">
                  {meta.label} · {meta.rate} tCO₂e/ha/yr
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block">
          <span className="label mb-1.5 block">Notes for the registry office</span>
          <textarea rows={3} className="field resize-none" value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Current condition of the land, access route, what you need supplied." />
        </label>

        <div className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-3">
          {[
            ['Area traced', `${ha.toFixed(2)} ha`],
            ['Members accepted', `${active} of ${MAX_MEMBERS}`],
            ['Parcel each (approx.)', active ? `${(ha / active).toFixed(2)} ha` : '—'],
          ].map(([k, v]) => (
            <div key={k}>
              <p className="label">{k}</p>
              <p className="tabular mt-1 text-sm font-semibold text-slate-100">{v}</p>
            </div>
          ))}
        </div>

        {error && <Alert kind="error">{error}</Alert>}

        <button className="btn-primary w-full !py-3" disabled={busy || !active}>
          {busy && <Loader2 size={15} className="animate-spin" aria-hidden />}
          <FileCheck2 size={16} aria-hidden />
          Submit application
        </button>
        {!active && (
          <p className="text-center text-xs text-slate-500">
            At least one member must accept their invitation before you can apply.
          </p>
        )}
      </form>
    </Panel>
  );
}

/* ------------------------------------------------------------ parcel view */

function ChunkDetail({ chunkId, date, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setData(null);
    setError('');
    api.get(`/leader/chunks/${chunkId}?date=${date}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [chunkId, date]);

  if (error) return <Panel title="Parcel"><Alert kind="error">{error}</Alert></Panel>;
  if (!data) return <Panel title="Parcel"><Spinner label="Loading parcel" /></Panel>;

  const { chunk, entry, history } = data;

  return (
    <Panel
      title={`Parcel ${chunk.label}`}
      bodyClass="p-0"
      action={
        <button type="button" onClick={onClose} className="cursor-pointer rounded-lg p-1 text-slate-400 hover:bg-white/8 hover:text-slate-100" aria-label="Close parcel">
          <X size={16} />
        </button>
      }
    >
      <div className="border-b border-white/8 px-5 py-4">
        <p className="text-sm font-semibold text-slate-100">{chunk.member_name ?? 'Unassigned'}</p>
        <p className="mt-0.5 text-xs text-slate-400">
          @{chunk.member_username} · {num(chunk.area_hectares, 2)} ha
        </p>
        {chunk.member_phone && (
          <a href={`tel:${chunk.member_phone}`} className="mt-2 inline-flex items-center gap-1.5 text-xs text-tide-300 hover:underline">
            <Phone size={12} aria-hidden />
            {chunk.member_phone}
          </a>
        )}
      </div>

      <div className="border-b border-white/8 px-5 py-4">
        <p className="label mb-2">{dateLabel(date)}</p>
        {entry ? (
          <>
            <img
              src={entry.photo_path}
              alt={`Parcel ${chunk.label} on ${dateLabel(date)}`}
              className="h-48 w-full rounded-xl border border-white/10 object-cover"
            />
            <dl className="mt-3 grid grid-cols-3 gap-2">
              {[
                ['Temp', `${num(entry.temperature_c, 1)}°C`],
                ['Humidity', `${num(entry.humidity_pct, 0)}%`],
                ['Soil', `${num(entry.soil_moisture_pct, 0)}%`],
                ['Soil pH', entry.soil_ph != null ? num(entry.soil_ph, 1) : '—'],
                ['Salinity', entry.salinity_ppt != null ? `${num(entry.salinity_ppt, 1)} ppt` : '—'],
                ['Saplings', num(entry.saplings_planted)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2">
                  <dt className="text-[10px] uppercase tracking-wider text-slate-500">{k}</dt>
                  <dd className="tabular mt-0.5 text-xs font-semibold text-slate-100">{v}</dd>
                </div>
              ))}
            </dl>
            {entry.notes && (
              <p className="mt-3 rounded-lg bg-white/[0.03] px-3 py-2 text-xs italic text-slate-300">
                “{entry.notes}”
              </p>
            )}
            <p className="mt-2 text-[11px] text-slate-500">
              Filed at {timeLabel(entry.created_at)} · watered: {entry.watered ? 'yes' : 'no'}
            </p>
          </>
        ) : (
          <div className="rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-amber-200">
              <AlertCircle size={15} aria-hidden />
              No entry for this day
            </p>
            <p className="mt-1 text-xs leading-relaxed text-amber-200/70">
              Follow up with {chunk.member_name?.split(' ')[0] ?? 'this member'} in person or by
              phone. Every missed parcel lowers the community’s participation rate for the day.
            </p>
          </div>
        )}
      </div>

      <div>
        <p className="label px-5 pb-2 pt-4">Recent history</p>
        {history.length === 0 ? (
          <p className="px-5 pb-5 text-xs text-slate-500">Nothing logged on this parcel yet.</p>
        ) : (
          <ul className="scrollbar-slim max-h-64 divide-y divide-white/8 overflow-y-auto">
            {history.map((h) => (
              <li key={h.id} className="flex items-center gap-3 px-5 py-2.5">
                <img src={h.photo_path} alt="" loading="lazy"
                  className="h-9 w-9 shrink-0 rounded-md border border-white/10 object-cover" />
                <span className="text-xs text-slate-300">{dateLabel(h.entry_date)}</span>
                <span className="tabular ml-auto text-[11px] text-slate-500">
                  {num(h.temperature_c, 1)}°C · {num(h.soil_moisture_pct, 0)}%
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ page */

export default function LeaderDashboard() {
  const [tab, setTab] = useState(null);
  const [mine, setMine] = useState(null);
  const [project, setProject] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [ledger, setLedger] = useState(null);
  const [date, setDate] = useState(todayISO());
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadMine = useCallback(
    () => api.get('/communities/mine').then(setMine).catch((e) => setError(e.message)),
    []
  );

  const loadProject = useCallback(
    (d) => api.get(`/leader/project?date=${d}`).then(setProject).catch(() => setProject(null)),
    []
  );

  useEffect(() => {
    Promise.all([loadMine(), loadProject(date)]).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (project?.project) loadProject(date); }, [date, loadProject]); // eslint-disable-line

  useEffect(() => {
    if (!project?.project) return;
    api.get('/leader/timeline').then(({ timeline: t }) => setTimeline(t)).catch(() => {});
    api.get('/leader/credits').then(setLedger).catch(() => {});
  }, [project?.project?.id]); // eslint-disable-line

  const refresh = useCallback(() => {
    setLoading(true);
    Promise.all([loadMine(), loadProject(date)]).finally(() => setLoading(false));
  }, [loadMine, loadProject, date]);

  const hasProject = Boolean(project?.project);

  // Leaders with a live project land on the map; everyone else starts on the roster.
  useEffect(() => { setTab(hasProject ? 'map' : 'community'); }, [hasProject]);

  const parcels = useMemo(() => {
    if (!project?.chunks) return [];
    return project.chunks.map((c) => ({
      id: c.id,
      label: c.label,
      geometry: c.geometry,
      centroid: [c.centroid_lat, c.centroid_lng],
      state: !c.member_id ? 'unassigned' : c.entry_id ? 'reported' : 'pending',
      tooltip: `${c.label} · ${c.member_name ?? 'Unassigned'} · ${c.entry_id ? 'reported' : 'not yet reported'}`,
    }));
  }, [project]);

  const chartData = useMemo(
    () => timeline.map((t) => ({
      date: shortDate(t.date),
      participation: t.assigned ? Math.round((t.reported / t.assigned) * 100) : 0,
    })),
    [timeline]
  );

  if (loading && !mine) {
    return <AppShell><Spinner label="Loading your community" /></AppShell>;
  }

  const tabs = [
    ...(hasProject ? [{ id: 'map', label: 'Project map', icon: MapIcon }] : []),
    { id: 'community', label: 'Community', icon: Users, count: mine?.roster?.length },
    ...(hasProject ? [{ id: 'ledger', label: 'Credits', icon: Coins }] : []),
  ];

  return (
    <AppShell tabs={tabs} activeTab={tab} onTab={setTab}>
      {error && <div className="mb-5"><Alert kind="error">{error}</Alert></div>}

      {/* ------------------------------------------------------- map tab */}
      {tab === 'map' && hasProject && (
        <>
          <PageHead
            eyebrow={`${project.project.code} · ${project.project.community_name}`}
            title={project.project.name}
            description={`${num(project.project.area_hectares, 2)} hectares across ${project.chunks.length} parcels, started ${dateLabel(project.project.start_date)}.`}
            right={
              <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] p-1">
                <button type="button" className="cursor-pointer rounded-lg p-2 text-slate-300 hover:bg-white/8"
                  onClick={() => setDate(shiftISO(date, -1))} aria-label="Previous day">
                  <ChevronLeft size={16} />
                </button>
                <input
                  type="date"
                  value={date}
                  max={todayISO()}
                  onChange={(e) => setDate(e.target.value || todayISO())}
                  className="tabular cursor-pointer bg-transparent px-2 text-sm text-slate-100 [color-scheme:dark]"
                  aria-label="Reporting day"
                />
                <button type="button" className="cursor-pointer rounded-lg p-2 text-slate-300 hover:bg-white/8 disabled:opacity-30"
                  onClick={() => setDate(shiftISO(date, 1))} disabled={date >= todayISO()} aria-label="Next day">
                  <ChevronRight size={16} />
                </button>
              </div>
            }
          />

          <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Reported today"
              value={`${project.today.reported}/${project.today.assigned}`}
              icon={Gauge}
              hint={`${pct(project.today.participation)} of parcels filed for ${dateLabel(date)}`}
            />
            <Stat
              label="Your credit for the day"
              value={num(project.today.creditEarned, 2)}
              unit={`of ${project.today.maxCredit}`}
              icon={Coins}
              tone="amber"
              hint="2 credits × the day’s participation rate."
            />
            <Stat
              label="Community credits"
              value={num(project.credits.communityTotal, 1)}
              icon={Users}
              tone="sky"
              hint={`Your balance: ${num(project.credits.leaderTotal, 1)} over ${project.credits.leaderDays} days`}
            />
            <Stat
              label="Verified carbon"
              value={num(project.carbon.verifiedTonnes, 1)}
              unit="tCO₂e"
              icon={Leaf}
              hint={`${num(project.carbon.grossTonnes, 1)} t modelled × ${pct(project.lifetimeParticipation)} participation`}
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
            <div className="space-y-5">
              <Panel
                title="Community area"
                bodyClass="p-3"
                action={<span className="text-xs text-slate-400">Click a parcel for its day</span>}
              >
                <MapCanvas
                  className="h-[480px]"
                  basemap="satellite"
                  center={[project.chunks[0]?.centroid_lat ?? 21.9, project.chunks[0]?.centroid_lng ?? 88.6]}
                  zoom={15}
                  legend={
                    <div className="space-y-1">
                      <LegendRow color={PARCEL_COLORS.reported}>Reported</LegendRow>
                      <LegendRow color={PARCEL_COLORS.pending}>Not yet reported</LegendRow>
                      <LegendRow color={PARCEL_COLORS.unassigned}>Unassigned</LegendRow>
                    </div>
                  }
                >
                  <BoundaryLayer geometry={project.project.boundary} />
                  <ParcelLayer
                    parcels={parcels}
                    selectedId={selected}
                    onSelect={(p) => setSelected(p.id)}
                  />
                  <FitTo geometry={project.project.boundary} />
                </MapCanvas>
              </Panel>

              <Panel title="Participation over the last 30 days" bodyClass="px-2 py-4">
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 6, right: 12, bottom: 0, left: -18 }}>
                      <defs>
                        <linearGradient id="participation" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#34D399" stopOpacity={0.45} />
                          <stop offset="100%" stopColor="#34D399" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: '#64748B', fontSize: 11 }} tickLine={false}
                        axisLine={false} interval={4} />
                      <YAxis domain={[0, 100]} unit="%" tick={{ fill: '#64748B', fontSize: 11 }}
                        tickLine={false} axisLine={false} width={44} />
                      <RTooltip
                        contentStyle={{
                          background: '#071F26', border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: 12, fontSize: 12, color: '#E2E8F0',
                        }}
                        formatter={(v) => [`${v}%`, 'Parcels reported']}
                      />
                      <Area type="monotone" dataKey="participation" stroke="#34D399" strokeWidth={2}
                        fill="url(#participation)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Panel>
            </div>

            <div className="space-y-5">
              {selected ? (
                <ChunkDetail chunkId={selected} date={date} onClose={() => setSelected(null)} />
              ) : (
                <Panel
                  title={`Not reported · ${dateLabel(date)}`}
                  bodyClass="p-0"
                  action={
                    <Badge tone={project.today.pending.length ? 'amber' : 'tide'}>
                      {project.today.pending.length} pending
                    </Badge>
                  }
                >
                  <div className="border-b border-white/8 px-5 py-4">
                    <div className="mb-2 flex items-baseline justify-between text-xs">
                      <span className="text-slate-400">Participation</span>
                      <span className="tabular font-semibold text-slate-100">
                        {pct(project.today.participation)}
                      </span>
                    </div>
                    <Meter value={project.today.participation} tone={project.today.participation > 0.75 ? 'tide' : 'amber'} />
                  </div>

                  {project.today.pending.length === 0 ? (
                    <EmptyState icon={TrendingUp} title="Every parcel is reported">
                      Full participation for {dateLabel(date)} — you earn the maximum
                      {' '}{project.today.maxCredit} credits for the day.
                    </EmptyState>
                  ) : (
                    <ul className="scrollbar-slim max-h-[420px] divide-y divide-white/8 overflow-y-auto">
                      {project.today.pending.map((c) => (
                        <li key={c.id} className="flex items-center gap-3 px-5 py-3">
                          <span className="tabular grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-400/12 text-[11px] font-semibold text-amber-300">
                            {c.label}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-slate-100">{c.member_name}</p>
                            <p className="truncate text-[11px] text-slate-500">
                              {c.last_entry ? `Last filed ${dateLabel(c.last_entry)}` : 'Never filed an entry'}
                            </p>
                          </div>
                          {c.member_phone && (
                            <a href={`tel:${c.member_phone}`} className="btn-ghost !px-2.5 !py-1.5" aria-label={`Call ${c.member_name}`}>
                              <Phone size={13} aria-hidden />
                            </a>
                          )}
                          <button type="button" className="btn-ghost !px-2.5 !py-1.5"
                            onClick={() => setSelected(c.id)} aria-label={`Open parcel ${c.label}`}>
                            <ChevronRight size={14} aria-hidden />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
              )}

              <Panel title="All parcels" bodyClass="p-0">
                <ul className="scrollbar-slim max-h-96 divide-y divide-white/8 overflow-y-auto">
                  {project.chunks.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => setSelected(c.id)}
                        className={`flex w-full cursor-pointer items-center gap-3 px-5 py-2.5 text-left transition
                          hover:bg-white/[0.05] ${selected === c.id ? 'bg-white/[0.06]' : ''}`}
                      >
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                          style={{
                            background: !c.member_id
                              ? PARCEL_COLORS.unassigned
                              : c.entry_id ? PARCEL_COLORS.reported : PARCEL_COLORS.pending,
                          }}
                          aria-hidden
                        />
                        <span className="tabular w-8 shrink-0 text-xs font-semibold text-slate-300">{c.label}</span>
                        <span className="min-w-0 flex-1 truncate text-sm text-slate-200">
                          {c.member_name ?? 'Unassigned'}
                        </span>
                        <span className="tabular shrink-0 text-[11px] text-slate-500">
                          {num(c.area_hectares, 2)} ha
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>
          </div>
        </>
      )}

      {/* ------------------------------------------------- community tab */}
      {tab === 'community' && (
        <>
          <PageHead
            eyebrow="Community"
            title={mine?.community?.name ?? 'Set up your community'}
            description={
              mine?.community
                ? `${mine.community.district ?? ''}${mine.community.district ? ', ' : ''}${mine.community.state ?? ''} · up to ${MAX_MEMBERS} households`
                : 'Create the collective, invite your members, then apply for the programme.'
            }
            right={
              mine?.application && (
                <Badge tone={STATUS_META[mine.application.status]?.tone}>
                  {STATUS_META[mine.application.status]?.label}
                </Badge>
              )
            }
          />

          {!mine?.community ? (
            <div className="max-w-xl"><CreateCommunity onCreated={refresh} /></div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
              <div className="space-y-5">
                <Panel
                  title="Members"
                  bodyClass="p-5"
                  action={
                    <span className="tabular text-xs text-slate-400">
                      {mine.roster.filter((r) => r.status === 'active').length} accepted ·{' '}
                      {mine.roster.filter((r) => r.status === 'pending').length} pending
                    </span>
                  }
                >
                  <MemberSearch disabled={Boolean(mine.application)} onInvited={refresh} />

                  {mine.roster.length === 0 ? (
                    <EmptyState icon={UserPlus} title="No members yet">
                      Search for each household by the username they registered with, then send a
                      join request. They accept from their own dashboard.
                    </EmptyState>
                  ) : (
                    <ul className="mt-4 divide-y divide-white/8">
                      {mine.roster.map((m) => (
                        <li key={m.id} className="flex items-center gap-3 py-3">
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/6 text-sm font-semibold text-slate-300">
                            {m.full_name.slice(0, 1)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-slate-100">{m.full_name}</p>
                            <p className="truncate text-xs text-slate-500">
                              @{m.username}{m.village ? ` · ${m.village}` : ''}
                            </p>
                          </div>
                          <Badge tone={m.status === 'active' ? 'tide' : 'amber'}>
                            {m.status === 'active' ? 'Accepted' : 'Invited'}
                          </Badge>
                          {!mine.application && (
                            <button
                              type="button"
                              className="cursor-pointer rounded-lg p-1.5 text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-300"
                              aria-label={`Remove ${m.full_name}`}
                              onClick={() =>
                                api.del(`/communities/members/${m.user_id}`).then(refresh).catch((e) => setError(e.message))
                              }
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>

                {mine.application && (
                  <Panel title="Application status">
                    <div className="space-y-3.5">
                      {[
                        ['Project', mine.application.title],
                        ['Area applied for', `${num(mine.application.area_hectares, 2)} ha`],
                        ['Ecosystem', ECOSYSTEM_META[mine.application.ecosystem]?.label],
                        ['Submitted', dateLabel(mine.application.created_at)],
                        ['Site visit', mine.application.visit_date ? dateLabel(mine.application.visit_date) : 'Not scheduled yet'],
                      ].map(([k, v]) => (
                        <div key={k} className="flex items-baseline justify-between gap-4">
                          <span className="text-xs text-slate-400">{k}</span>
                          <span className="text-right text-sm font-medium text-slate-100">{v}</span>
                        </div>
                      ))}
                      {mine.application.review_note && (
                        <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs leading-relaxed text-slate-300">
                          <span className="font-semibold text-slate-100">Registry note: </span>
                          {mine.application.review_note}
                        </p>
                      )}
                    </div>
                  </Panel>
                )}
              </div>

              {!mine.application ? (
                <ApplyPanel roster={mine.roster} onApplied={refresh} />
              ) : (
                <Panel title="Area applied for" bodyClass="p-3">
                  <MapCanvas className="h-[420px]" basemap="satellite">
                    <BoundaryLayer
                      geometry={mine.project?.boundary ?? mine.application.proposed_area}
                      color="#34D399"
                    />
                    <FitTo geometry={mine.project?.boundary ?? mine.application.proposed_area} />
                  </MapCanvas>
                  <p className="px-2 pb-1 pt-3 text-xs leading-relaxed text-slate-400">
                    {mine.project
                      ? 'This is the surveyed boundary the registry office approved, now split into parcels.'
                      : 'This is the area you applied for. The officer may adjust it after the site visit.'}
                  </p>
                </Panel>
              )}
            </div>
          )}
        </>
      )}

      {/* ---------------------------------------------------- ledger tab */}
      {tab === 'ledger' && hasProject && (
        <>
          <PageHead
            eyebrow="Credits"
            title="Stewardship ledger"
            description="Every credit earned so far. When the two-year term ends, sale proceeds are divided across these balances."
          />

          <div className="mb-5 grid gap-4 sm:grid-cols-3">
            <Stat label="Your credits" value={num(project.credits.leaderTotal, 1)} icon={Coins} tone="amber"
              hint={`Earned over ${project.credits.leaderDays} reporting days`} />
            <Stat label="Community total" value={num(project.credits.communityTotal, 1)} icon={Users}
              hint="Members plus leader" />
            <Stat label="Lifetime participation" value={pct(project.lifetimeParticipation, 1)} icon={Gauge} tone="sky"
              hint="Average share of parcels reporting each day" />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title="Members by credits earned" bodyClass="p-0">
              {!ledger?.members?.length ? (
                <EmptyState icon={Users} title="No credits recorded yet" />
              ) : (
                <ul className="divide-y divide-white/8">
                  {ledger.members.map((m, i) => {
                    const top = Number(ledger.members[0].credits) || 1;
                    return (
                      <li key={m.id} className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <span className="tabular w-5 text-xs text-slate-500">{i + 1}</span>
                          <span className="tabular w-8 shrink-0 text-xs font-semibold text-slate-300">{m.label}</span>
                          <span className="min-w-0 flex-1 truncate text-sm text-slate-100">{m.full_name}</span>
                          <span className="tabular text-sm font-semibold text-tide-300">
                            {num(m.credits, 1)}
                          </span>
                        </div>
                        <Meter value={Number(m.credits) / top} className="mt-2" />
                        <p className="mt-1.5 text-[11px] text-slate-500">{m.active_days} days reported</p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>

            <Panel title="Your daily credits" bodyClass="p-0">
              {!ledger?.ledger?.length ? (
                <EmptyState icon={CalendarDays} title="No days credited yet" />
              ) : (
                <ul className="scrollbar-slim max-h-[520px] divide-y divide-white/8 overflow-y-auto">
                  {ledger.ledger.map((row) => (
                    <li key={row.date} className="flex items-center gap-4 px-5 py-3">
                      <span className="w-24 shrink-0 text-xs text-slate-300">{dateLabel(row.date)}</span>
                      <Meter value={Number(row.participation_rate ?? 0)} className="flex-1" tone="amber" />
                      <span className="tabular w-20 shrink-0 text-right text-xs text-slate-400">
                        {pct(row.participation_rate)}
                      </span>
                      <span className="tabular w-12 shrink-0 text-right text-sm font-semibold text-sun-300">
                        {num(row.amount, 2)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </>
      )}
    </AppShell>
  );
}

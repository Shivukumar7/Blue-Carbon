import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays, Camera, CheckCircle2, Clock, Coins, Droplets, Flame, ImageIcon,
  Inbox, Loader2, MapPin, Ruler, Sprout, Thermometer, Upload, Waves,
} from 'lucide-react';
import AppShell, { PageHead } from '../components/AppShell.jsx';
import MapCanvas, { FitTo, LegendRow } from '../components/MapCanvas.jsx';
import ParcelLayer, { BoundaryLayer, PARCEL_COLORS } from '../components/ParcelLayer.jsx';
import { Alert, Badge, EmptyState, Meter, Panel, Spinner, Stat } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { dateLabel, num, shortDate } from '../lib/format.js';

/* ------------------------------------------------------- invitation inbox */

function Invitations({ onAccepted }) {
  const [invites, setInvites] = useState([]);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.get('/communities/invitations')
      .then(({ invitations }) => setInvites(invitations))
      .catch((e) => setError(e.message));
  }, []);

  useEffect(load, [load]);

  async function respond(id, accept) {
    setBusy(id);
    setError('');
    try {
      await api.post(`/communities/invitations/${id}/respond`, { accept });
      load();
      if (accept) onAccepted();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Panel title="Invitations" bodyClass="p-0">
      {error && <div className="p-4"><Alert kind="error">{error}</Alert></div>}
      {invites.length === 0 ? (
        <EmptyState icon={Inbox} title="No invitations waiting">
          Ask your community leader to search for your username and send a join request. It will
          appear here the moment they do.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-white/8">
          {invites.map((inv) => (
            <li key={inv.id} className="flex flex-wrap items-center gap-4 p-5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-100">{inv.name}</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  Led by {inv.leader_name} (@{inv.leader_username}) · {inv.district}, {inv.state}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => respond(inv.id, false)}
                  disabled={busy === inv.id}
                >
                  Decline
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => respond(inv.id, true)}
                  disabled={busy === inv.id}
                >
                  {busy === inv.id && <Loader2 size={15} className="animate-spin" aria-hidden />}
                  Accept
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------ entry form */

const READINGS = [
  { key: 'temperatureC', label: 'Air temperature', unit: '°C', icon: Thermometer, step: '0.1', min: -10, max: 60, required: true },
  { key: 'humidityPct', label: 'Relative humidity', unit: '%', icon: Droplets, step: '0.1', min: 0, max: 100, required: true },
  { key: 'soilMoisturePct', label: 'Soil moisture', unit: '%', icon: Waves, step: '0.1', min: 0, max: 100, required: true },
  { key: 'soilPh', label: 'Soil pH', unit: '', icon: Sprout, step: '0.1', min: 0, max: 14 },
  { key: 'salinityPpt', label: 'Salinity', unit: 'ppt', icon: Droplets, step: '0.1', min: 0, max: 60 },
  { key: 'saplingsPlanted', label: 'Saplings planted today', unit: '', icon: Sprout, step: '1', min: 0, max: 500 },
];

function EntryForm({ onDone }) {
  const [values, setValues] = useState({});
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const [notes, setNotes] = useState('');
  const [watered, setWatered] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  function pick(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) return setError('Choose an image file.');
    if (file.size > 8 * 1024 * 1024) return setError('That photo is larger than 8 MB.');
    setError('');
    setPhoto(file);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(file);
    });
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!photo) return setError("Add today's photo of your parcel.");

    const body = new FormData();
    body.append('photo', photo);
    for (const { key } of READINGS) if (values[key] !== undefined && values[key] !== '') body.append(key, values[key]);
    body.append('watered', String(watered));
    if (notes) body.append('notes', notes);

    setBusy(true);
    try {
      await api.upload('/member/entries', body);
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {/* photo */}
      <div>
        <p className="label mb-2">Today&apos;s photo</p>
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files?.[0]); }}
          className="relative overflow-hidden rounded-xl border border-dashed border-white/15 bg-white/[0.03]
                     transition hover:border-tide-400/50"
        >
          {preview ? (
            <div className="relative">
              <img src={preview} alt="Preview of today's parcel photo" className="h-56 w-full object-cover" />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="btn-ghost absolute bottom-3 right-3 !bg-abyss-950/80"
              >
                <Camera size={14} aria-hidden />
                Replace
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full cursor-pointer flex-col items-center gap-2 px-6 py-12 text-center"
            >
              <span className="grid h-11 w-11 place-items-center rounded-full bg-tide-500/15 text-tide-300">
                <Upload size={19} aria-hidden />
              </span>
              <span className="text-sm font-semibold text-slate-200">
                Take or upload a photo of your parcel
              </span>
              <span className="text-xs text-slate-500">
                Drop it here, or tap to open your camera · JPG, PNG or WebP up to 8 MB
              </span>
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => pick(e.target.files?.[0])}
          />
        </div>
      </div>

      {/* readings */}
      <div>
        <p className="label mb-2">Instrument readings</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {READINGS.map((r) => (
            <label key={r.key} className="block">
              <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-300">
                <r.icon size={13} className="text-tide-400" aria-hidden />
                {r.label}
                {r.required && <span className="text-tide-400">*</span>}
              </span>
              <div className="relative">
                <input
                  type="number"
                  inputMode="decimal"
                  step={r.step}
                  min={r.min}
                  max={r.max}
                  required={r.required}
                  value={values[r.key] ?? ''}
                  onChange={(e) => setValues({ ...values, [r.key]: e.target.value })}
                  className="field tabular pr-10"
                />
                {r.unit && (
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                    {r.unit}
                  </span>
                )}
              </div>
            </label>
          ))}
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
        <input
          type="checkbox"
          checked={watered}
          onChange={(e) => setWatered(e.target.checked)}
          className="h-4 w-4 cursor-pointer accent-tide-500"
        />
        <span className="text-sm text-slate-200">I watered the saplings on this parcel today</span>
      </label>

      <label className="block">
        <span className="label mb-1.5 block">Notes for your leader (optional)</span>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Anything unusual — high tide, damage, pests…"
          className="field resize-none"
        />
      </label>

      {error && <Alert kind="error">{error}</Alert>}

      <button type="submit" className="btn-primary w-full !py-3" disabled={busy}>
        {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <CheckCircle2 size={16} aria-hidden />}
        Submit today&apos;s entry and earn 1 credit
      </button>
    </form>
  );
}

/* ------------------------------------------------------------------ page */

export default function MemberDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    return api.get('/member/home')
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const parcels = useMemo(() => {
    if (!data?.chunk) return [];
    return [{
      id: data.chunk.id,
      label: data.chunk.label,
      geometry: data.chunk.geometry,
      state: 'mine',
      centroid: [data.chunk.centroid_lat, data.chunk.centroid_lng],
      tooltip: `Parcel ${data.chunk.label} · ${num(data.chunk.area_hectares, 2)} ha`,
    }];
  }, [data]);

  if (loading) {
    return <AppShell><Spinner label="Loading your parcel" /></AppShell>;
  }

  /* ---------------------------------------------- not yet in a project */
  if (!data?.chunk) {
    return (
      <AppShell>
        <PageHead
          eyebrow="Member"
          title="You are not tending a parcel yet"
          description="Once your leader adds you and the registry office approves the project area, your own parcel will appear here with its daily log."
        />
        {error && <div className="mb-5"><Alert kind="error">{error}</Alert></div>}

        <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
          <Invitations onAccepted={load} />
          <Panel title="What happens next">
            <ol className="space-y-4">
              {[
                ['Accept your invitation', 'Your leader searches for your username and sends a request.'],
                ['Wait for the site survey', 'A government officer visits the coastal area in person and hands over saplings and meters.'],
                ['Receive your parcel', 'The approved area is split between members — yours appears on this page.'],
                ['Report every day', 'A photo plus three readings earns you one credit per day.'],
              ].map(([title, copy], i) => (
                <li key={title} className="flex gap-3.5">
                  <span className="tabular grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/6 text-xs font-semibold text-tide-300">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-slate-100">{title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{copy}</p>
                  </div>
                </li>
              ))}
            </ol>
            {data?.membership && (
              <p className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-slate-300">
                You are an accepted member of{' '}
                <span className="font-semibold text-slate-100">{data.membership.community_name}</span>.
                {data.membership.application_status === 'approved'
                  ? ' Parcels are being assigned.'
                  : ' The application is still with the registry office.'}
              </p>
            )}
          </Panel>
        </div>
      </AppShell>
    );
  }

  /* ------------------------------------------------------ active member */
  const { chunk, todayEntry, history, totals, streak, today } = data;
  const done = Boolean(todayEntry);

  return (
    <AppShell>
      <PageHead
        eyebrow={`${chunk.code} · ${chunk.community_name}`}
        title={`Parcel ${chunk.label}`}
        description={`${num(chunk.area_hectares, 2)} hectares of ${chunk.ecosystem} restoration, assigned to you on ${dateLabel(chunk.start_date)}.`}
        right={
          <Badge tone={done ? 'tide' : 'amber'}>
            {done ? <CheckCircle2 size={12} aria-hidden /> : <Clock size={12} aria-hidden />}
            {done ? 'Reported today' : 'Awaiting today’s entry'}
          </Badge>
        }
      />

      {error && <div className="mb-5"><Alert kind="error">{error}</Alert></div>}

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Credits earned" value={num(totals.credits, 1)} icon={Coins}
          hint="One credit for every complete daily entry." />
        <Stat label="Days reported" value={num(totals.active_days)} icon={CalendarDays} tone="sky"
          hint={`Since ${dateLabel(chunk.start_date)}`} />
        <Stat label="Current streak" value={num(streak)} unit="days" icon={Flame} tone="amber"
          hint={done ? 'Keep it going tomorrow.' : 'File today to extend it.'} />
        <Stat label="Parcel size" value={num(chunk.area_hectares, 2)} unit="ha" icon={Ruler} tone="slate"
          hint={`${num(chunk.project_area, 1)} ha across the whole project`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
        {/* map + history */}
        <div className="space-y-5">
          <Panel title="Your parcel" bodyClass="p-3"
            action={<span className="text-xs text-slate-400">Tap the map to explore</span>}>
            <MapCanvas
              className="h-[360px]"
              basemap="satellite"
              center={[chunk.centroid_lat, chunk.centroid_lng]}
              zoom={16}
              legend={
                <div className="space-y-1">
                  <LegendRow color={PARCEL_COLORS.mine}>Your parcel {chunk.label}</LegendRow>
                  <LegendRow color="#22D3EE">Project boundary</LegendRow>
                </div>
              }
            >
              <BoundaryLayer geometry={chunk.boundary} />
              <ParcelLayer parcels={parcels} selectedId={chunk.id} />
              <FitTo geometry={chunk.geometry} maxZoom={18} />
            </MapCanvas>
            <p className="px-2 pb-1 pt-3 text-xs leading-relaxed text-slate-400">
              <MapPin size={12} className="mr-1 inline text-tide-400" aria-hidden />
              Centre point {chunk.centroid_lat.toFixed(5)}, {chunk.centroid_lng.toFixed(5)} — use this to
              find your patch on the ground. Your leader is {chunk.leader_name}
              {chunk.leader_phone ? ` (${chunk.leader_phone})` : ''}.
            </p>
          </Panel>

          <Panel title="Your recent entries" bodyClass="p-0"
            action={<span className="tabular text-xs text-slate-400">{history.length} logged</span>}>
            {history.length === 0 ? (
              <EmptyState icon={ImageIcon} title="Nothing logged yet">
                Your first entry will appear here with its photo and readings.
              </EmptyState>
            ) : (
              <ul className="scrollbar-slim max-h-[420px] divide-y divide-white/8 overflow-y-auto">
                {history.map((h) => (
                  <li key={h.id} className="flex gap-4 p-4">
                    <img
                      src={h.photo_path}
                      alt=""
                      loading="lazy"
                      className="h-16 w-16 shrink-0 rounded-lg border border-white/10 object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-slate-100">{dateLabel(h.entry_date)}</p>
                        <Badge tone="tide">+1 credit</Badge>
                      </div>
                      <p className="tabular mt-1.5 text-xs text-slate-400">
                        {num(h.temperature_c, 1)}°C · {num(h.humidity_pct, 0)}% RH ·{' '}
                        {num(h.soil_moisture_pct, 0)}% soil
                        {h.saplings_planted > 0 && ` · ${h.saplings_planted} saplings`}
                      </p>
                      {h.notes && <p className="mt-1 text-xs italic text-slate-500">“{h.notes}”</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        {/* today's entry */}
        <Panel
          title={done ? 'Today is complete' : `Daily log · ${dateLabel(today)}`}
          action={
            !done && (
              <span className="tabular text-xs text-slate-400">
                {history.length ? `Last: ${shortDate(history[0].entry_date)}` : 'First entry'}
              </span>
            )
          }
        >
          {done ? (
            <div className="space-y-5">
              <div className="flex items-center gap-3 rounded-xl border border-tide-400/30 bg-tide-500/10 px-4 py-3.5">
                <CheckCircle2 size={20} className="shrink-0 text-tide-300" aria-hidden />
                <div>
                  <p className="text-sm font-semibold text-tide-100">Entry accepted · +1 credit</p>
                  <p className="text-xs text-tide-200/70">
                    Your leader can now see parcel {chunk.label} as reported for today.
                  </p>
                </div>
              </div>

              <img
                src={todayEntry.photo_path}
                alt={`Parcel ${chunk.label} on ${dateLabel(today)}`}
                className="h-56 w-full rounded-xl border border-white/10 object-cover"
              />

              <dl className="grid grid-cols-3 gap-3">
                {[
                  ['Temperature', `${num(todayEntry.temperature_c, 1)}°C`],
                  ['Humidity', `${num(todayEntry.humidity_pct, 0)}%`],
                  ['Soil moisture', `${num(todayEntry.soil_moisture_pct, 0)}%`],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
                    <dt className="text-[10px] uppercase tracking-wider text-slate-500">{k}</dt>
                    <dd className="tabular mt-1 text-sm font-semibold text-slate-100">{v}</dd>
                  </div>
                ))}
              </dl>

              <div>
                <div className="mb-1.5 flex items-baseline justify-between text-xs">
                  <span className="text-slate-400">Two-year term progress</span>
                  <span className="tabular text-slate-300">{num(totals.active_days)} days reported</span>
                </div>
                <Meter value={Math.min(1, totals.active_days / (365 * 2))} />
              </div>

              <p className="text-xs leading-relaxed text-slate-500">
                Come back tomorrow for the next entry. Missed days cannot be back-filled — that is
                what keeps the registry credible for buyers.
              </p>
            </div>
          ) : (
            <EntryForm onDone={load} />
          )}
        </Panel>
      </div>
    </AppShell>
  );
}

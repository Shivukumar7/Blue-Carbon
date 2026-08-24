import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, Coins, Gauge, Leaf, Loader2, MapPin, Phone, Ruler, ShoppingBag, Users,
} from 'lucide-react';
import AppShell, { PageHead } from '../components/AppShell.jsx';
import MapCanvas, { FitTo, LegendRow } from '../components/MapCanvas.jsx';
import ParcelLayer, { BoundaryLayer, PARCEL_COLORS } from '../components/ParcelLayer.jsx';
import { Alert, Badge, EmptyState, Meter, Panel, Spinner, Stat } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { ECOSYSTEM_META, STATUS_META, dateLabel, money, num, pct, todayISO } from '../lib/format.js';

export default function AdminProject() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(null);
  const [price, setPrice] = useState(1450);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(() => {
    api.get(`/admin/projects/${id}`).then(setData).catch((e) => setError(e.message));
  }, [id]);

  useEffect(load, [load]);

  const parcels = useMemo(() => {
    if (!data?.chunks) return [];
    const today = todayISO();
    return data.chunks.map((c) => ({
      id: c.id,
      label: c.label,
      geometry: c.geometry,
      centroid: [c.centroid_lat, c.centroid_lng],
      state: !c.assigned_to ? 'unassigned' : c.last_entry === today ? 'reported' : 'pending',
      tooltip: `${c.label} · ${c.member_name ?? 'Unassigned'} · ${c.entry_count} entries`,
    }));
  }, [data]);

  async function listOnMarket() {
    setBusy(true);
    setError('');
    try {
      const { listing } = await api.post(`/admin/projects/${id}/list`, { pricePerTonne: price });
      setNotice(
        `${num(listing.tonnes_available, 2)} tCO₂e listed at ${money(listing.price_per_tonne)} per tonne.`
      );
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return (
      <AppShell>
        {error ? <Alert kind="error">{error}</Alert> : <Spinner label="Loading project" />}
      </AppShell>
    );
  }

  const { project: p, chunks, recent, participation, carbon } = data;
  const reportedToday = chunks.filter((c) => c.last_entry === todayISO()).length;
  const assigned = chunks.filter((c) => c.assigned_to).length;

  return (
    <AppShell>
      <Link
        to="/admin"
        className="mb-5 inline-flex items-center gap-1.5 text-xs text-slate-400 transition hover:text-tide-300"
      >
        <ArrowLeft size={14} aria-hidden />
        Back to the registry
      </Link>

      <PageHead
        eyebrow={`${p.code} · ${p.community_name}`}
        title={p.name}
        description={`${ECOSYSTEM_META[p.ecosystem]?.label} · ${p.district}, ${p.state} · started ${dateLabel(p.start_date)} for ${p.duration_years} years`}
        right={<Badge tone={STATUS_META[p.status]?.tone}>{STATUS_META[p.status]?.label}</Badge>}
      />

      {error && <div className="mb-5"><Alert kind="error">{error}</Alert></div>}
      {notice && <div className="mb-5"><Alert kind="success">{notice}</Alert></div>}

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Registered area" value={num(p.area_hectares, 2)} unit="ha" icon={Ruler}
          hint={`${chunks.length} parcels · ${assigned} assigned`} />
        <Stat label="Reporting today" value={`${reportedToday}/${assigned}`} icon={Gauge} tone="amber"
          hint={`Lifetime participation ${pct(participation, 1)}`} />
        <Stat label="Verified carbon" value={num(carbon.verifiedTonnes, 1)} unit="tCO₂e" icon={Leaf}
          hint={`${num(carbon.grossTonnes, 1)} t modelled over ${num(carbon.elapsedYears, 2)} years`} />
        <Stat label="Sequestration rate" value={num(p.sequestration_rate, 1)} unit="t/ha/yr"
          icon={Coins} tone="slate" hint="Published rate for this ecosystem" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5">
          <Panel title="Parcel map" bodyClass="p-3"
            action={<span className="text-xs text-slate-400">Click a parcel to inspect it</span>}>
            <MapCanvas
              className="h-[480px]"
              basemap="satellite"
              center={[chunks[0]?.centroid_lat ?? 21.9, chunks[0]?.centroid_lng ?? 88.6]}
              zoom={15}
              legend={
                <div className="space-y-1">
                  <LegendRow color={PARCEL_COLORS.reported}>Reported today</LegendRow>
                  <LegendRow color={PARCEL_COLORS.pending}>Not reported today</LegendRow>
                  <LegendRow color={PARCEL_COLORS.unassigned}>Unassigned</LegendRow>
                </div>
              }
            >
              <BoundaryLayer geometry={p.boundary} />
              <ParcelLayer parcels={parcels} selectedId={selected?.id} onSelect={setSelected} />
              <FitTo geometry={p.boundary} />
            </MapCanvas>
          </Panel>

          <Panel title="Latest field entries" bodyClass="p-0">
            {recent.length === 0 ? (
              <EmptyState icon={Leaf} title="No entries filed yet" />
            ) : (
              <ul className="scrollbar-slim max-h-[420px] divide-y divide-white/8 overflow-y-auto">
                {recent.map((e) => (
                  <li key={e.id} className="flex gap-4 p-4">
                    <img src={e.photo_path} alt="" loading="lazy"
                      className="h-14 w-14 shrink-0 rounded-lg border border-white/10 object-cover" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-medium text-slate-100">
                          <span className="tabular mr-2 text-tide-300">{e.label}</span>
                          {e.member_name}
                        </p>
                        <span className="shrink-0 text-xs text-slate-500">
                          {dateLabel(e.entry_date)}
                        </span>
                      </div>
                      <p className="tabular mt-1 text-xs text-slate-400">
                        {num(e.temperature_c, 1)}°C · {num(e.humidity_pct, 0)}% RH ·{' '}
                        {num(e.soil_moisture_pct, 0)}% soil
                        {e.saplings_planted > 0 && ` · ${e.saplings_planted} saplings`}
                      </p>
                      {e.notes && <p className="mt-1 truncate text-xs italic text-slate-500">“{e.notes}”</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel title="Community">
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-100">{p.community_name}</p>
              <p className="flex items-center gap-1.5 text-xs text-slate-400">
                <MapPin size={12} aria-hidden />
                {p.district}, {p.state}
              </p>
              {p.description && <p className="text-xs leading-relaxed text-slate-400">{p.description}</p>}
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <p className="text-xs font-medium text-slate-200">{p.leader_name}</p>
                <p className="text-[11px] text-slate-500">Community leader · @{p.leader_username}</p>
                {p.leader_phone && (
                  <a href={`tel:${p.leader_phone}`} className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-tide-300 hover:underline">
                    <Phone size={11} aria-hidden />
                    {p.leader_phone}
                  </a>
                )}
              </div>
            </div>
          </Panel>

          <Panel title={selected ? `Parcel ${selected.label}` : `Parcels (${chunks.length})`} bodyClass="p-0">
            <ul className="scrollbar-slim max-h-[380px] divide-y divide-white/8 overflow-y-auto">
              {chunks.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(parcels.find((x) => x.id === c.id))}
                    className={`flex w-full cursor-pointer items-center gap-3 px-5 py-2.5 text-left transition
                      hover:bg-white/[0.05] ${selected?.id === c.id ? 'bg-white/[0.06]' : ''}`}
                  >
                    <span className="tabular w-8 shrink-0 text-xs font-semibold text-slate-300">{c.label}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-slate-200">{c.member_name ?? 'Unassigned'}</p>
                      <p className="truncate text-[11px] text-slate-500">
                        {c.entry_count} entries · last {c.last_entry ? dateLabel(c.last_entry) : 'never'}
                      </p>
                    </div>
                    <span className="tabular shrink-0 text-[11px] text-slate-500">
                      {num(c.area_hectares, 2)} ha
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Release to the marketplace">
            <div className="space-y-4">
              <div>
                <div className="mb-1.5 flex items-baseline justify-between text-xs">
                  <span className="text-slate-400">Two-year term progress</span>
                  <span className="tabular text-slate-300">
                    {num(carbon.elapsedYears, 2)} / {p.duration_years} yrs
                  </span>
                </div>
                <Meter value={Math.min(1, carbon.elapsedYears / p.duration_years)} tone="sky" />
              </div>

              <label className="block">
                <span className="label mb-1.5 block">Price per tonne (₹)</span>
                <input
                  type="number"
                  min="100"
                  step="50"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="field tabular"
                />
              </label>

              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <p className="flex items-baseline justify-between text-xs">
                  <span className="text-slate-400">Verified tonnes available</span>
                  <span className="tabular font-semibold text-tide-300">
                    {num(carbon.verifiedTonnes, 2)}
                  </span>
                </p>
                <p className="mt-1.5 flex items-baseline justify-between text-xs">
                  <span className="text-slate-400">Estimated proceeds</span>
                  <span className="tabular font-semibold text-sun-300">
                    {money(carbon.verifiedTonnes * Number(price || 0))}
                  </span>
                </p>
              </div>

              <button type="button" className="btn-primary w-full" disabled={busy} onClick={listOnMarket}>
                {busy ? <Loader2 size={15} className="animate-spin" aria-hidden />
                      : <ShoppingBag size={15} aria-hidden />}
                List verified tonnes
              </button>

              <p className="text-[11px] leading-relaxed text-slate-500">
                Listing publishes this project on the public programme page, where buyers can
                purchase without an account. Proceeds are divided across the community&apos;s credit
                balances — currently held by {assigned} members and their leader.
              </p>
            </div>
          </Panel>

          <Panel title="Participation">
            <div className="flex items-center gap-3">
              <Users size={16} className="text-tide-400" aria-hidden />
              <div className="flex-1">
                <Meter value={participation} />
              </div>
              <span className="tabular text-sm font-semibold text-slate-100">{pct(participation, 1)}</span>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-400">
              Modelled carbon is discounted by this figure before anything can be sold, so
              incomplete reporting directly reduces what the community earns.
            </p>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}

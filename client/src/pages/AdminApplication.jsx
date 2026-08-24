import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, CalendarCheck, CheckCircle2, Loader2, MapPin, Phone, Ruler, ShieldCheck,
  Users, XCircle,
} from 'lucide-react';
import AppShell, { PageHead } from '../components/AppShell.jsx';
import MapCanvas, { FitTo } from '../components/MapCanvas.jsx';
import { BoundaryLayer } from '../components/ParcelLayer.jsx';
import AreaDrawer, { DrawToolbar } from '../components/AreaDrawer.jsx';
import { Alert, Badge, Panel, Spinner, Stat } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { areaHectares } from '../lib/geo.js';
import { ECOSYSTEM_META, STATUS_META, dateLabel, num, todayISO } from '../lib/format.js';

export default function AdminApplication() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [map, setMap] = useState(null);
  const [boundary, setBoundary] = useState(null);
  const [reviewNote, setReviewNote] = useState('');
  const [visitDate, setVisitDate] = useState(todayISO());
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.get(`/admin/applications/${id}`)
      .then((d) => {
        setData(d);
        setBoundary(d.application.proposed_area);
        setReviewNote(d.application.review_note ?? '');
        if (d.application.visit_date) setVisitDate(String(d.application.visit_date).slice(0, 10));
      })
      .catch((e) => setError(e.message));
  }, [id]);

  useEffect(load, [load]);

  async function setStatus(status) {
    setBusy(status);
    setError('');
    try {
      await api.patch(`/admin/applications/${id}/status`, { status, reviewNote, visitDate });
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  }

  async function approve() {
    setBusy('approve');
    setError('');
    try {
      const { project } = await api.post(`/admin/applications/${id}/approve`, {
        boundary, reviewNote, startDate: todayISO(),
      });
      navigate(`/admin/projects/${project.id}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  }

  if (!data) {
    return (
      <AppShell>
        {error ? <Alert kind="error">{error}</Alert> : <Spinner label="Loading application" />}
      </AppShell>
    );
  }

  const { application: a, members } = data;
  const approved = a.status === 'approved';
  const drawnHa = boundary ? areaHectares(boundary) : 0;
  const perMember = members.length ? drawnHa / members.length : 0;

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
        eyebrow={`Application #${a.id} · ${a.community_name}`}
        title={a.title}
        description={`${a.district}, ${a.state} · submitted ${dateLabel(a.created_at)} by ${a.leader_name}`}
        right={<Badge tone={STATUS_META[a.status]?.tone}>{STATUS_META[a.status]?.label}</Badge>}
      />

      {error && <div className="mb-5"><Alert kind="error">{error}</Alert></div>}

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Area applied for" value={num(a.area_hectares, 2)} unit="ha" icon={Ruler} />
        <Stat label="Active members" value={num(members.length)} icon={Users} tone="sky"
          hint="Each will receive one parcel" />
        <Stat label="Ecosystem" value={ECOSYSTEM_META[a.ecosystem]?.label ?? a.ecosystem}
          icon={ShieldCheck} tone="slate"
          hint={`${ECOSYSTEM_META[a.ecosystem]?.rate} tCO₂e per hectare each year`} />
        <Stat label="Site visit" value={a.visit_date ? dateLabel(a.visit_date) : 'Not set'}
          icon={CalendarCheck} tone="amber" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        {/* ------------------------------------------------- boundary work */}
        <Panel
          title={approved ? 'Approved boundary' : 'Surveyed boundary'}
          bodyClass="p-3"
          action={<span className="text-xs text-slate-400">
            {approved ? 'Locked' : 'Adjust the points to match your survey'}
          </span>}
        >
          <MapCanvas className="h-[460px]" basemap="satellite" mapRef={setMap}>
            {approved ? (
              <>
                <BoundaryLayer geometry={a.proposed_area} color="#34D399" />
                <FitTo geometry={a.proposed_area} />
              </>
            ) : (
              <>
                <AreaDrawer value={boundary} onChange={setBoundary} />
                <FitTo geometry={a.proposed_area} />
              </>
            )}
          </MapCanvas>

          {!approved && (
            <div className="px-1 pt-4">
              <DrawToolbar
                map={map}
                value={boundary}
                onChange={setBoundary}
                hint="The community's traced area is loaded for you. Drag its points to match what you measured on site, or clear it and draw the boundary from scratch."
              />
            </div>
          )}

          <div className="mt-4 grid gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-3">
            {[
              ['Boundary area', `${drawnHa.toFixed(2)} ha`],
              ['Parcels to create', num(members.length)],
              ['Each parcel (approx.)', perMember ? `${perMember.toFixed(2)} ha` : '—'],
            ].map(([k, v]) => (
              <div key={k}>
                <p className="label">{k}</p>
                <p className="tabular mt-1 text-sm font-semibold text-slate-100">{v}</p>
              </div>
            ))}
          </div>
        </Panel>

        {/* ---------------------------------------------------- side panel */}
        <div className="space-y-5">
          <Panel title="Community">
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-slate-100">{a.community_name}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
                  <MapPin size={12} aria-hidden />
                  {a.district}, {a.state}
                </p>
              </div>
              {a.description && (
                <p className="text-xs leading-relaxed text-slate-400">{a.description}</p>
              )}
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <p className="text-xs font-medium text-slate-200">{a.leader_name}</p>
                <p className="text-[11px] text-slate-500">Community leader · @{a.leader_username}</p>
                {a.leader_phone && (
                  <a href={`tel:${a.leader_phone}`} className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-tide-300 hover:underline">
                    <Phone size={11} aria-hidden />
                    {a.leader_phone}
                  </a>
                )}
              </div>
              {a.notes && (
                <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs leading-relaxed text-slate-300">
                  <span className="font-semibold text-slate-100">From the leader: </span>{a.notes}
                </p>
              )}
            </div>
          </Panel>

          <Panel title={`Members receiving parcels (${members.length})`} bodyClass="p-0">
            <ul className="scrollbar-slim max-h-64 divide-y divide-white/8 overflow-y-auto">
              {members.map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-5 py-2.5">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/6 text-[11px] font-semibold text-slate-300">
                    {m.full_name.slice(0, 1)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-slate-100">{m.full_name}</p>
                    <p className="truncate text-[11px] text-slate-500">
                      @{m.username}{m.village ? ` · ${m.village}` : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>

          {approved ? (
            <Panel title="Decision">
              <Alert kind="success">
                Approved on {dateLabel(a.reviewed_at)}. The area has been divided into parcels and
                assigned to members.
              </Alert>
            </Panel>
          ) : (
            <Panel title="Review and decide">
              <div className="space-y-4">
                <label className="block">
                  <span className="label mb-1.5 block">Site visit date</span>
                  <input
                    type="date"
                    value={visitDate}
                    onChange={(e) => setVisitDate(e.target.value)}
                    className="field tabular [color-scheme:dark]"
                  />
                </label>

                <label className="block">
                  <span className="label mb-1.5 block">Officer note</span>
                  <textarea
                    rows={3}
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    placeholder="What you found on site, supplies handed over, conditions attached."
                    className="field resize-none"
                  />
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <button type="button" className="btn-ghost" disabled={Boolean(busy)}
                    onClick={() => setStatus('site_visit_scheduled')}>
                    {busy === 'site_visit_scheduled'
                      ? <Loader2 size={14} className="animate-spin" aria-hidden />
                      : <CalendarCheck size={14} aria-hidden />}
                    Schedule visit
                  </button>
                  <button type="button" className="btn-ghost" disabled={Boolean(busy)}
                    onClick={() => setStatus('site_visited')}>
                    {busy === 'site_visited'
                      ? <Loader2 size={14} className="animate-spin" aria-hidden />
                      : <ShieldCheck size={14} aria-hidden />}
                    Mark verified
                  </button>
                </div>

                <button
                  type="button"
                  className="btn-primary w-full !py-3"
                  disabled={Boolean(busy) || !boundary || !members.length}
                  onClick={approve}
                >
                  {busy === 'approve'
                    ? <Loader2 size={16} className="animate-spin" aria-hidden />
                    : <CheckCircle2 size={16} aria-hidden />}
                  Approve and create {members.length} parcels
                </button>

                <button
                  type="button"
                  className="btn w-full border border-rose-400/25 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20"
                  disabled={Boolean(busy)}
                  onClick={() => setStatus('rejected')}
                >
                  {busy === 'rejected'
                    ? <Loader2 size={14} className="animate-spin" aria-hidden />
                    : <XCircle size={14} aria-hidden />}
                  Reject application
                </button>

                <p className="text-[11px] leading-relaxed text-slate-500">
                  Approving is final: the boundary above is split into {members.length} parcels and
                  assigned to members immediately, and daily reporting opens the same day.
                </p>
              </div>
            </Panel>
          )}
        </div>
      </div>
    </AppShell>
  );
}

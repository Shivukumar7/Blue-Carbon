import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts';
import {
  ArrowUpRight, Banknote, ClipboardList, Coins, Download, FileText, Gauge, Leaf, MapIcon,
  MapPin, ShoppingBag, Users,
} from 'lucide-react';
import AppShell, { PageHead } from '../components/AppShell.jsx';
import MapCanvas, { FitTo } from '../components/MapCanvas.jsx';
import { BoundaryLayer } from '../components/ParcelLayer.jsx';
import { Badge, EmptyState, Meter, Panel, Spinner, Stat } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { ECOSYSTEM_META, STATUS_META, dateLabel, money, num, pct, shortDate } from '../lib/format.js';

const TABS = [
  { id: 'overview', label: 'Overview', icon: Gauge },
  { id: 'applications', label: 'Applications', icon: ClipboardList },
  { id: 'projects', label: 'Live projects', icon: MapIcon },
  { id: 'orders', label: 'Marketplace', icon: ShoppingBag },
];

export default function AdminDashboard() {
  const [tab, setTab] = useState('overview');
  const [overview, setOverview] = useState(null);
  const [applications, setApplications] = useState([]);
  const [projects, setProjects] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/admin/overview').then(setOverview).catch(() => {}),
      api.get('/admin/applications').then(({ applications: a }) => setApplications(a)).catch(() => {}),
      api.get('/admin/projects').then(({ projects: p }) => setProjects(p)).catch(() => {}),
      api.get('/admin/orders').then(({ orders: o }) => setOrders(o)).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const pending = useMemo(
    () => applications.filter((a) => !['approved', 'rejected'].includes(a.status)),
    [applications]
  );

  const trend = useMemo(
    () => (overview?.trend ?? []).map((t) => ({ date: shortDate(t.date), entries: t.entries })),
    [overview]
  );

  if (loading) return <AppShell><Spinner label="Loading the registry" /></AppShell>;

  const tabs = TABS.map((t) =>
    t.id === 'applications' ? { ...t, count: pending.length } : t
  );

  return (
    <AppShell tabs={tabs} activeTab={tab} onTab={setTab}>
      {/* ------------------------------------------------------- overview */}
      {tab === 'overview' && (
        <>
          <PageHead
            eyebrow="Government registry"
            title="National blue carbon registry"
            description="Applications awaiting a site visit, live restoration projects, and the credits they have issued."
          />

          <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Applications pending" value={num(overview?.stats.pending_applications)}
              icon={ClipboardList} tone="amber" hint="Awaiting review, visit or approval" />
            <Stat label="Live projects" value={num(overview?.stats.active_projects)} icon={MapIcon}
              hint={`${num(overview?.stats.hectares_under_restoration, 1)} hectares under restoration`} />
            <Stat label="People enrolled" value={num((overview?.stats.members ?? 0) + (overview?.stats.leaders ?? 0))}
              icon={Users} tone="sky"
              hint={`${num(overview?.stats.leaders)} leaders · ${num(overview?.stats.members)} members`} />
            <Stat label="Credits issued" value={num(overview?.stats.credits_issued, 1)} icon={Coins}
              hint={`${num(overview?.stats.entries_today)} field entries filed today`} />
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
            <Panel title="Field entries · last 14 days" bodyClass="px-2 py-4">
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trend} margin={{ top: 6, right: 12, bottom: 0, left: -20 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: '#64748B', fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: '#64748B', fontSize: 11 }} tickLine={false} axisLine={false} width={40} />
                    <RTooltip
                      cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                      contentStyle={{
                        background: '#071F26', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 12, fontSize: 12, color: '#E2E8F0',
                      }}
                    />
                    <Bar dataKey="entries" fill="#34D399" radius={[5, 5, 0, 0]} maxBarSize={26} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel
              title="Needs your attention"
              bodyClass="p-0"
              action={<Badge tone={pending.length ? 'amber' : 'tide'}>{pending.length} open</Badge>}
            >
              {pending.length === 0 ? (
                <EmptyState icon={ClipboardList} title="Nothing waiting">
                  Every application has been reviewed. New submissions from community leaders will
                  appear here.
                </EmptyState>
              ) : (
                <ul className="divide-y divide-white/8">
                  {pending.slice(0, 6).map((a) => (
                    <li key={a.id}>
                      <Link
                        to={`/admin/applications/${a.id}`}
                        className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-white/[0.05]"
                      >
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-400/12 text-amber-300">
                          <FileText size={16} aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-100">{a.community_name}</p>
                          <p className="truncate text-xs text-slate-500">
                            {num(a.area_hectares, 1)} ha · {a.active_members} members · {a.district}, {a.state}
                          </p>
                        </div>
                        <Badge tone={STATUS_META[a.status]?.tone}>{STATUS_META[a.status]?.label}</Badge>
                        <ArrowUpRight size={15} className="shrink-0 text-slate-500" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </>
      )}

      {/* --------------------------------------------------- applications */}
      {tab === 'applications' && (
        <>
          <PageHead
            eyebrow="Review queue"
            title="Community applications"
            description="Each application is for a stretch of unused coastal land. Schedule a visit, verify it on the ground, then trace and approve the surveyed boundary."
          />

          {applications.length === 0 ? (
            <Panel><EmptyState icon={ClipboardList} title="No applications yet" /></Panel>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {applications.map((a) => (
                <Link
                  key={a.id}
                  to={`/admin/applications/${a.id}`}
                  className="panel-solid group flex flex-col overflow-hidden transition duration-300
                             hover:-translate-y-0.5 hover:border-tide-400/30"
                >
                  <div className="h-36">
                    <MapCanvas className="!rounded-none h-full !border-0" basemap="satellite" showSwitcher={false}>
                      <BoundaryLayer geometry={a.proposed_area} color="#FBBF24" />
                      <FitTo geometry={a.proposed_area} padding={16} maxZoom={15} />
                    </MapCanvas>
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-sm font-semibold leading-snug text-slate-100">{a.title}</h3>
                      <Badge tone={STATUS_META[a.status]?.tone}>{STATUS_META[a.status]?.label}</Badge>
                    </div>
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
                      <MapPin size={12} aria-hidden />
                      {a.community_name} · {a.district}, {a.state}
                    </p>
                    <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-white/8 pt-3.5">
                      {[
                        ['Area', `${num(a.area_hectares, 1)} ha`],
                        ['Members', num(a.active_members)],
                        ['Type', ECOSYSTEM_META[a.ecosystem]?.label.split(' ')[0]],
                      ].map(([k, v]) => (
                        <div key={k}>
                          <dt className="text-[10px] uppercase tracking-wider text-slate-500">{k}</dt>
                          <dd className="tabular mt-0.5 text-sm font-semibold text-slate-100">{v}</dd>
                        </div>
                      ))}
                    </dl>
                    <p className="mt-4 text-[11px] text-slate-500">
                      Submitted {dateLabel(a.created_at)} by {a.leader_name}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      {/* -------------------------------------------------------- projects */}
      {tab === 'projects' && (
        <>
          <PageHead
            eyebrow="Live projects"
            title="Registered restoration sites"
            description="Every approved project, its daily reporting health, and the carbon it has accrued so far."
          />

          {projects.length === 0 ? (
            <Panel><EmptyState icon={MapIcon} title="No projects have been approved yet" /></Panel>
          ) : (
            <Panel bodyClass="p-0">
              <div className="scrollbar-slim overflow-x-auto">
                <table className="w-full min-w-[900px] text-left">
                  <thead>
                    <tr className="border-b border-white/8 text-[11px] uppercase tracking-wider text-slate-500">
                      <th className="px-5 py-3 font-semibold">Project</th>
                      <th className="px-5 py-3 font-semibold">Community</th>
                      <th className="px-5 py-3 text-right font-semibold">Area</th>
                      <th className="px-5 py-3 text-right font-semibold">Parcels</th>
                      <th className="px-5 py-3 font-semibold">Participation</th>
                      <th className="px-5 py-3 text-right font-semibold">Verified tCO₂e</th>
                      <th className="px-5 py-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/6">
                    {projects.map((p) => (
                      <tr key={p.id} className="group transition hover:bg-white/[0.04]">
                        <td className="px-5 py-3.5">
                          <Link to={`/admin/projects/${p.id}`} className="block">
                            <span className="font-mono text-[11px] text-tide-400">{p.code}</span>
                            <span className="block text-sm font-medium text-slate-100 group-hover:text-tide-300">
                              {p.name}
                            </span>
                          </Link>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="block text-sm text-slate-200">{p.community_name}</span>
                          <span className="block text-[11px] text-slate-500">{p.district}, {p.state}</span>
                        </td>
                        <td className="tabular px-5 py-3.5 text-right text-sm text-slate-200">
                          {num(p.area_hectares, 1)} ha
                        </td>
                        <td className="tabular px-5 py-3.5 text-right text-sm text-slate-200">{p.chunk_count}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <Meter value={Number(p.participation)} className="w-24" />
                            <span className="tabular text-xs text-slate-400">{pct(p.participation)}</span>
                          </div>
                          <span className="mt-1 block text-[11px] text-slate-500">
                            {p.entries_today} filed today
                          </span>
                        </td>
                        <td className="tabular px-5 py-3.5 text-right text-sm font-semibold text-tide-300">
                          {num(p.carbon.verifiedTonnes, 1)}
                        </td>
                        <td className="px-5 py-3.5">
                          <Badge tone={STATUS_META[p.status]?.tone}>{STATUS_META[p.status]?.label}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}
        </>
      )}

      {/* ---------------------------------------------------------- orders */}
      {tab === 'orders' && (
        <>
          <PageHead
            eyebrow="Marketplace"
            title="Credit retirements"
            description="Purchases made from the public programme page. Proceeds are distributed across the selling community's credit balances."
          />

          <div className="mb-5 grid gap-4 sm:grid-cols-3">
            <Stat label="Revenue collected" value={money(overview?.stats.marketplace_revenue)} icon={Banknote}
              tone="amber" hint="Across all paid orders" />
            <Stat label="Orders" value={num(orders.length)} icon={ShoppingBag}
              hint="Buyers do not need an account" />
            <Stat
              label="Tonnes retired"
              value={num(orders.reduce((s, o) => s + Number(o.tonnes), 0), 1)}
              unit="tCO₂e"
              icon={Leaf}
              tone="sky"
            />
          </div>

          <Panel bodyClass="p-0">
            {orders.length === 0 ? (
              <EmptyState icon={ShoppingBag} title="No purchases yet">
                List a project&apos;s verified tonnes from its detail page to open it for sale.
              </EmptyState>
            ) : (
              <div className="scrollbar-slim overflow-x-auto">
                <table className="w-full min-w-[920px] text-left">
                  <thead>
                    <tr className="border-b border-white/8 text-[11px] uppercase tracking-wider text-slate-500">
                      <th className="px-5 py-3 font-semibold">Certificate</th>
                      <th className="px-5 py-3 font-semibold">Buyer</th>
                      <th className="px-5 py-3 font-semibold">Project</th>
                      <th className="px-5 py-3 font-semibold">Serials</th>
                      <th className="px-5 py-3 text-right font-semibold">Tonnes</th>
                      <th className="px-5 py-3 text-right font-semibold">Amount</th>
                      <th className="px-5 py-3 font-semibold">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/6">
                    {orders.map((o) => (
                      <tr key={o.id} className="transition hover:bg-white/[0.04]">
                        <td className="px-5 py-3.5">
                          <a
                            href={`/api/market/orders/${o.reference}/certificate.pdf`}
                            download={`blue-carbon-certificate-${o.reference}.pdf`}
                            className="inline-flex items-center gap-1.5 font-mono text-xs text-tide-300
                                       transition hover:text-tide-200 hover:underline"
                            title="Download the retirement certificate"
                          >
                            <Download size={12} aria-hidden />
                            {o.reference}
                          </a>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="block text-sm text-slate-100">{o.buyer_name}</span>
                          <span className="block text-[11px] text-slate-500">
                            {o.buyer_org || o.buyer_email}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-sm text-slate-200">{o.project_name}</td>
                        <td className="px-5 py-3.5 font-mono text-[11px] text-slate-400">
                          {o.serial_start
                            ? `${String(o.serial_start).padStart(6, '0')}–${String(o.serial_end).padStart(6, '0')}`
                            : '—'}
                        </td>
                        <td className="tabular px-5 py-3.5 text-right text-sm text-slate-200">
                          {num(o.tonnes, 2)}
                        </td>
                        <td className="tabular px-5 py-3.5 text-right">
                          <span className="block text-sm font-semibold text-sun-300">
                            {money(o.total_amount)}
                          </span>
                          <span className="block text-[10px] uppercase tracking-wider text-slate-500">
                            {o.payment_method ?? '—'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-400">{dateLabel(o.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}
    </AppShell>
  );
}

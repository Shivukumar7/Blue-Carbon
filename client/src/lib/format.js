export const num = (value, digits = 0) =>
  Number(value ?? 0).toLocaleString('en-IN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

export const money = (value) =>
  `₹${Number(value ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export const pct = (value, digits = 0) => `${(Number(value ?? 0) * 100).toFixed(digits)}%`;

export const dateLabel = (iso) =>
  iso
    ? new Date(`${String(iso).slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '—';

export const shortDate = (iso) =>
  iso
    ? new Date(`${String(iso).slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
      })
    : '—';

export const timeLabel = (iso) =>
  iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : '';

/** Today in the browser's timezone as YYYY-MM-DD. */
export function todayISO() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function shiftISO(iso, days) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export const STATUS_META = {
  submitted: { label: 'Submitted', tone: 'sky' },
  site_visit_scheduled: { label: 'Visit scheduled', tone: 'amber' },
  site_visited: { label: 'Site verified', tone: 'violet' },
  approved: { label: 'Approved', tone: 'tide' },
  rejected: { label: 'Rejected', tone: 'rose' },
  active: { label: 'Active', tone: 'tide' },
  matured: { label: 'Matured', tone: 'sky' },
  listed: { label: 'On market', tone: 'amber' },
  sold: { label: 'Sold', tone: 'slate' },
};

export const ECOSYSTEM_META = {
  mangrove: { label: 'Mangrove', rate: 6.5 },
  seagrass: { label: 'Seagrass meadow', rate: 3.9 },
  saltmarsh: { label: 'Salt marsh', rate: 5.2 },
};

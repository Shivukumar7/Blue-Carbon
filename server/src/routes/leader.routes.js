import { Router } from 'express';
import { one, many } from '../db.js';
import { authenticate, requireRole, wrap } from '../lib/auth.js';
import { carbonEstimate } from '../lib/geo.js';
import { projectParticipation, LEADER_DAILY_CREDIT } from '../lib/credits.js';

const router = Router();
router.use(authenticate, requireRole('leader'));

async function leaderProject(userId) {
  return one(
    `SELECT p.*, c.name AS community_name, c.district, c.state
       FROM projects p JOIN communities c ON c.id = p.community_id
      WHERE c.leader_id = $1 ORDER BY p.created_at DESC LIMIT 1`,
    [userId]
  );
}

function todayISO() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/**
 * Everything the leader map needs: the boundary, every parcel with its owner, and
 * whether that owner has reported for the selected day.
 */
router.get('/project', wrap(async (req, res) => {
  const project = await leaderProject(req.user.id);
  if (!project) return res.json({ project: null });

  const date = req.query.date || todayISO();

  const chunks = await many(
    `SELECT ch.id, ch.label, ch.geometry, ch.centroid_lat, ch.centroid_lng, ch.area_hectares,
            u.id AS member_id, u.full_name AS member_name, u.username AS member_username,
            u.phone AS member_phone,
            de.id AS entry_id, de.created_at AS reported_at,
            (SELECT COUNT(*)::int FROM daily_entries d2 WHERE d2.chunk_id = ch.id) AS total_entries,
            (SELECT MAX(entry_date)::text FROM daily_entries d3 WHERE d3.chunk_id = ch.id) AS last_entry
       FROM chunks ch
       LEFT JOIN users u ON u.id = ch.assigned_to
       LEFT JOIN daily_entries de ON de.chunk_id = ch.id AND de.entry_date = $2
      WHERE ch.project_id = $1
      ORDER BY ch.label`,
    [project.id, date]
  );

  const reported = chunks.filter((c) => c.entry_id).length;
  const assigned = chunks.filter((c) => c.member_id).length;
  const participation = assigned ? reported / assigned : 0;

  const lifetime = await projectParticipation(project.id);
  const creditRow = await one(
    `SELECT COALESCE(SUM(amount),0) AS total, COUNT(*)::int AS days
       FROM credits WHERE user_id = $1 AND role = 'leader'`,
    [req.user.id]
  );
  const communityCredits = await one(
    'SELECT COALESCE(SUM(amount),0) AS total FROM credits WHERE project_id = $1',
    [project.id]
  );

  res.json({
    project,
    date,
    chunks,
    today: {
      reported,
      assigned,
      pending: chunks.filter((c) => c.member_id && !c.entry_id),
      participation,
      creditEarned: Number((LEADER_DAILY_CREDIT * participation).toFixed(3)),
      maxCredit: LEADER_DAILY_CREDIT,
    },
    credits: { leaderTotal: Number(creditRow.total), leaderDays: creditRow.days,
      communityTotal: Number(communityCredits.total) },
    carbon: carbonEstimate({
      areaHectares: project.area_hectares,
      rate: project.sequestration_rate,
      startDate: project.start_date,
      participation: lifetime,
    }),
    lifetimeParticipation: lifetime,
  });
}));

/** One parcel: the selected day's submission plus its recent history. */
router.get('/chunks/:id', wrap(async (req, res) => {
  const project = await leaderProject(req.user.id);
  if (!project) return res.status(404).json({ error: 'No project found' });

  const chunk = await one(
    `SELECT ch.*, u.full_name AS member_name, u.username AS member_username, u.phone AS member_phone
       FROM chunks ch LEFT JOIN users u ON u.id = ch.assigned_to
      WHERE ch.id = $1 AND ch.project_id = $2`,
    [req.params.id, project.id]
  );
  if (!chunk) return res.status(404).json({ error: 'Parcel not found' });

  const date = req.query.date || todayISO();
  const entry = await one(
    'SELECT *, entry_date::text AS entry_date FROM daily_entries WHERE chunk_id = $1 AND entry_date = $2',
    [chunk.id, date]
  );
  const history = await many(
    `SELECT id, entry_date::text AS entry_date, photo_path, temperature_c, humidity_pct,
            soil_moisture_pct, soil_ph, salinity_ppt, saplings_planted, watered, notes, created_at
       FROM daily_entries WHERE chunk_id = $1 ORDER BY entry_date DESC LIMIT 60`,
    [chunk.id]
  );

  res.json({ chunk, date, entry, history });
}));

/** 30-day participation strip for the leader dashboard chart. */
router.get('/timeline', wrap(async (req, res) => {
  const project = await leaderProject(req.user.id);
  if (!project) return res.json({ timeline: [] });

  const timeline = await many(
    `SELECT d::date::text AS date,
            (SELECT COUNT(*)::int FROM daily_entries de
              WHERE de.project_id = $1 AND de.entry_date = d::date) AS reported,
            (SELECT COUNT(*)::int FROM chunks WHERE project_id = $1 AND assigned_to IS NOT NULL) AS assigned
       FROM generate_series(CURRENT_DATE - INTERVAL '29 days', CURRENT_DATE, INTERVAL '1 day') AS d
      ORDER BY d`,
    [project.id]
  );
  res.json({ timeline });
}));

router.get('/credits', wrap(async (req, res) => {
  const project = await leaderProject(req.user.id);
  if (!project) return res.json({ ledger: [], members: [] });

  const ledger = await many(
    `SELECT credit_date::text AS date, amount, participation_rate
       FROM credits WHERE user_id = $1 AND role = 'leader'
      ORDER BY credit_date DESC LIMIT 60`,
    [req.user.id]
  );
  const members = await many(
    `SELECT u.id, u.full_name, u.username, ch.label,
            COALESCE(SUM(cr.amount), 0) AS credits,
            COUNT(cr.id)::int AS active_days
       FROM chunks ch
       JOIN users u ON u.id = ch.assigned_to
       LEFT JOIN credits cr ON cr.user_id = u.id AND cr.role = 'member' AND cr.project_id = ch.project_id
      WHERE ch.project_id = $1
      GROUP BY u.id, u.full_name, u.username, ch.label
      ORDER BY credits DESC`,
    [project.id]
  );
  res.json({ ledger, members });
}));

export default router;

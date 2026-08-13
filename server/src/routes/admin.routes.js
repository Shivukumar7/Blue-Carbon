import { Router } from 'express';
import { query, one, many, tx } from '../db.js';
import { authenticate, requireRole, wrap } from '../lib/auth.js';
import { splitIntoChunks, hectares, carbonEstimate, SEQUESTRATION_RATES } from '../lib/geo.js';
import { projectParticipation } from '../lib/credits.js';

const router = Router();
router.use(authenticate, requireRole('admin'));

// ------------------------------------------------------------------ overview
router.get('/overview', wrap(async (req, res) => {
  const stats = await one(`
    SELECT
      (SELECT COUNT(*)::int FROM applications WHERE status IN ('submitted','site_visit_scheduled','site_visited')) AS pending_applications,
      (SELECT COUNT(*)::int FROM projects WHERE status = 'active') AS active_projects,
      (SELECT COUNT(*)::int FROM users WHERE role = 'member') AS members,
      (SELECT COUNT(*)::int FROM users WHERE role = 'leader') AS leaders,
      (SELECT COALESCE(SUM(area_hectares),0) FROM projects) AS hectares_under_restoration,
      (SELECT COALESCE(SUM(amount),0) FROM credits) AS credits_issued,
      (SELECT COUNT(*)::int FROM daily_entries WHERE entry_date = CURRENT_DATE) AS entries_today,
      (SELECT COALESCE(SUM(total_amount),0) FROM orders WHERE status = 'paid') AS marketplace_revenue
  `);

  const trend = await many(`
    SELECT entry_date::text AS date, COUNT(*)::int AS entries
      FROM daily_entries
     WHERE entry_date > CURRENT_DATE - INTERVAL '14 days'
     GROUP BY entry_date ORDER BY entry_date`);

  res.json({ stats, trend });
}));

// -------------------------------------------------------------- applications
router.get('/applications', wrap(async (req, res) => {
  const { status } = req.query;
  const applications = await many(
    `SELECT a.*, c.name AS community_name, c.district, c.state,
            u.full_name AS leader_name, u.username AS leader_username, u.phone AS leader_phone,
            (SELECT COUNT(*)::int FROM community_members cm
              WHERE cm.community_id = c.id AND cm.status = 'active') AS active_members
       FROM applications a
       JOIN communities c ON c.id = a.community_id
       JOIN users u ON u.id = c.leader_id
      WHERE ($1::text IS NULL OR a.status = $1)
      ORDER BY a.created_at DESC`,
    [status || null]
  );
  res.json({ applications });
}));

router.get('/applications/:id', wrap(async (req, res) => {
  const application = await one(
    `SELECT a.*, c.name AS community_name, c.district, c.state, c.description,
            u.full_name AS leader_name, u.username AS leader_username,
            u.phone AS leader_phone, u.email AS leader_email
       FROM applications a
       JOIN communities c ON c.id = a.community_id
       JOIN users u ON u.id = c.leader_id
      WHERE a.id = $1`,
    [req.params.id]
  );
  if (!application) return res.status(404).json({ error: 'Application not found' });

  const members = await many(
    `SELECT u.id, u.username, u.full_name, u.village, u.phone, cm.status
       FROM community_members cm JOIN users u ON u.id = cm.user_id
      WHERE cm.community_id = $1 AND cm.status = 'active' ORDER BY u.full_name`,
    [application.community_id]
  );
  res.json({ application, members });
}));

router.patch('/applications/:id/status', wrap(async (req, res) => {
  const { status, reviewNote, visitDate } = req.body;
  const allowed = ['site_visit_scheduled', 'site_visited', 'rejected'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Unsupported status change' });

  const { rows } = await query(
    `UPDATE applications
        SET status = $1, review_note = COALESCE($2, review_note), visit_date = COALESCE($3, visit_date),
            reviewer_id = $4, reviewed_at = now()
      WHERE id = $5 RETURNING *`,
    [status, reviewNote || null, visitDate || null, req.user.id, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Application not found' });
  res.json({ application: rows[0] });
}));

/**
 * Approve an application: the officer supplies the surveyed boundary drawn on the
 * map, the area is split into one parcel per active member, and a project is born.
 */
router.post('/applications/:id/approve', wrap(async (req, res) => {
  const { boundary, name, startDate, durationYears = 2 } = req.body;
  if (!boundary || boundary.type !== 'Polygon') {
    return res.status(400).json({ error: 'Trace the surveyed boundary on the map before approving' });
  }

  const application = await one('SELECT * FROM applications WHERE id = $1', [req.params.id]);
  if (!application) return res.status(404).json({ error: 'Application not found' });
  if (application.status === 'approved') {
    return res.status(409).json({ error: 'This application is already approved' });
  }

  const members = await many(
    "SELECT user_id FROM community_members WHERE community_id = $1 AND status = 'active' ORDER BY user_id",
    [application.community_id]
  );
  if (!members.length) {
    return res.status(400).json({ error: 'The community has no active members to assign parcels to' });
  }

  const areaHa = Number(hectares(boundary).toFixed(3));
  const parcels = splitIntoChunks(boundary, members.length);

  const project = await tx(async (client) => {
    const codeRow = await client.query(
      `SELECT 'BCR-' || to_char(now(),'YYYY') || '-' ||
              lpad((COALESCE(MAX(id),0) + 1)::text, 4, '0') AS code FROM projects`);

    const inserted = await client.query(
      `INSERT INTO projects (application_id, community_id, code, name, ecosystem, boundary,
                             area_hectares, sequestration_rate, start_date, duration_years)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [application.id, application.community_id, codeRow.rows[0].code,
        name || application.title, application.ecosystem, boundary, areaHa,
        SEQUESTRATION_RATES[application.ecosystem] ?? 6.5,
        startDate || new Date().toISOString().slice(0, 10), durationYears]
    );
    const p = inserted.rows[0];

    for (let i = 0; i < parcels.length; i += 1) {
      const parcel = parcels[i];
      await client.query(
        `INSERT INTO chunks (project_id, label, geometry, centroid_lat, centroid_lng, area_hectares, assigned_to)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [p.id, parcel.label, parcel.geometry, parcel.centroid_lat, parcel.centroid_lng,
          parcel.area_hectares, members[i].user_id]
      );
    }

    await client.query(
      `UPDATE applications SET status = 'approved', reviewer_id = $1, reviewed_at = now(),
              review_note = COALESCE($2, review_note) WHERE id = $3`,
      [req.user.id, req.body.reviewNote || null, application.id]
    );
    return p;
  });

  res.status(201).json({ project, parcels: parcels.length });
}));

// ------------------------------------------------------------------ projects
router.get('/projects', wrap(async (req, res) => {
  const projects = await many(`
    SELECT p.*, c.name AS community_name, c.district, c.state,
           u.full_name AS leader_name, u.username AS leader_username,
           (SELECT COUNT(*)::int FROM chunks WHERE project_id = p.id) AS chunk_count,
           (SELECT COUNT(*)::int FROM daily_entries WHERE project_id = p.id AND entry_date = CURRENT_DATE) AS entries_today,
           (SELECT COALESCE(SUM(amount),0) FROM credits WHERE project_id = p.id) AS credits_issued,
           (SELECT COALESCE(AVG(participation_rate),0) FROM credits WHERE project_id = p.id AND role='leader') AS participation
      FROM projects p
      JOIN communities c ON c.id = p.community_id
      JOIN users u ON u.id = c.leader_id
     ORDER BY p.created_at DESC`);

  res.json({
    projects: projects.map((p) => ({
      ...p,
      carbon: carbonEstimate({
        areaHectares: p.area_hectares,
        rate: p.sequestration_rate,
        startDate: p.start_date,
        participation: p.participation || 0,
      }),
    })),
  });
}));

router.get('/projects/:id', wrap(async (req, res) => {
  const project = await one(
    `SELECT p.*, c.name AS community_name, c.district, c.state, c.description,
            u.full_name AS leader_name, u.username AS leader_username, u.phone AS leader_phone
       FROM projects p JOIN communities c ON c.id = p.community_id
       JOIN users u ON u.id = c.leader_id WHERE p.id = $1`,
    [req.params.id]
  );
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const chunks = await many(
    `SELECT ch.*, u.full_name AS member_name, u.username AS member_username,
            (SELECT COUNT(*)::int FROM daily_entries de WHERE de.chunk_id = ch.id) AS entry_count,
            (SELECT MAX(entry_date)::text FROM daily_entries de WHERE de.chunk_id = ch.id) AS last_entry
       FROM chunks ch LEFT JOIN users u ON u.id = ch.assigned_to
      WHERE ch.project_id = $1 ORDER BY ch.label`,
    [req.params.id]
  );
  const recent = await many(
    `SELECT de.*, ch.label, u.full_name AS member_name
       FROM daily_entries de JOIN chunks ch ON ch.id = de.chunk_id
       JOIN users u ON u.id = de.user_id
      WHERE de.project_id = $1 ORDER BY de.entry_date DESC, de.created_at DESC LIMIT 20`,
    [req.params.id]
  );
  const participation = await projectParticipation(req.params.id);

  res.json({
    project,
    chunks,
    recent,
    participation,
    carbon: carbonEstimate({
      areaHectares: project.area_hectares,
      rate: project.sequestration_rate,
      startDate: project.start_date,
      participation,
    }),
  });
}));

// -------------------------------------------------------------- market admin
router.post('/projects/:id/list', wrap(async (req, res) => {
  const { pricePerTonne, tonnes } = req.body;
  const project = await one('SELECT * FROM projects WHERE id = $1', [req.params.id]);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const participation = await projectParticipation(project.id);
  const carbon = carbonEstimate({
    areaHectares: project.area_hectares,
    rate: project.sequestration_rate,
    startDate: project.start_date,
    participation,
  });
  const available = Number(tonnes) > 0 ? Number(tonnes) : carbon.verifiedTonnes;
  if (available <= 0) {
    return res.status(400).json({ error: 'This project has not accrued any verified tonnes yet' });
  }

  const { rows } = await query(
    `INSERT INTO listings (project_id, tonnes_available, price_per_tonne, vintage_year)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [project.id, available, Number(pricePerTonne) || 1200, new Date().getFullYear()]
  );
  await query("UPDATE projects SET status = 'listed' WHERE id = $1", [project.id]);
  res.status(201).json({ listing: rows[0] });
}));

router.get('/orders', wrap(async (req, res) => {
  const orders = await many(
    `SELECT o.*, p.code AS project_code, p.name AS project_name
       FROM orders o JOIN listings l ON l.id = o.listing_id
       JOIN projects p ON p.id = l.project_id
      ORDER BY o.created_at DESC LIMIT 100`);
  res.json({ orders });
}));

export default router;

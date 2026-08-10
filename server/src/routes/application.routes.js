import { Router } from 'express';
import { query, one, many } from '../db.js';
import { authenticate, requireRole, wrap } from '../lib/auth.js';
import { hectares } from '../lib/geo.js';

const router = Router();
router.use(authenticate);

router.post('/', requireRole('leader'), wrap(async (req, res) => {
  const { title, ecosystem = 'mangrove', area, notes } = req.body;

  const community = await one('SELECT * FROM communities WHERE leader_id = $1', [req.user.id]);
  if (!community) return res.status(400).json({ error: 'Create your community first' });

  const open = await one(
    "SELECT 1 FROM applications WHERE community_id = $1 AND status <> 'rejected'",
    [community.id]
  );
  if (open) return res.status(409).json({ error: 'Your community already has an application on file' });

  const active = await one(
    "SELECT COUNT(*)::int AS n FROM community_members WHERE community_id = $1 AND status = 'active'",
    [community.id]
  );
  if (active.n < 1) {
    return res.status(400).json({ error: 'Add at least one member who has accepted their invitation' });
  }
  if (!area || area.type !== 'Polygon') {
    return res.status(400).json({ error: 'Draw the coastal area you are applying for on the map' });
  }

  const areaHa = hectares(area);
  if (areaHa < 0.05) return res.status(400).json({ error: 'The selected area is too small to register' });

  const { rows } = await query(
    `INSERT INTO applications (community_id, title, ecosystem, proposed_area, area_hectares, member_count, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [community.id, title || `${community.name} restoration`, ecosystem, area,
     Number(areaHa.toFixed(3)), active.n, notes || null]
  );
  res.status(201).json({ application: rows[0] });
}));

router.get('/mine', requireRole('leader'), wrap(async (req, res) => {
  const applications = await many(
    `SELECT a.* FROM applications a
       JOIN communities c ON c.id = a.community_id
      WHERE c.leader_id = $1 ORDER BY a.created_at DESC`,
    [req.user.id]
  );
  res.json({ applications });
}));

export default router;

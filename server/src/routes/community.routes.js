import { Router } from 'express';
import { query, one, many } from '../db.js';
import { authenticate, requireRole, wrap } from '../lib/auth.js';

const router = Router();
export const MAX_MEMBERS = 25;

router.use(authenticate);

/** The community owned by the signed-in leader (or 404). */
async function leaderCommunity(userId) {
  return one('SELECT * FROM communities WHERE leader_id = $1', [userId]);
}

// ---------------------------------------------------------------- leader side
router.post('/', requireRole('leader'), wrap(async (req, res) => {
  const { name, district, state, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Community name is required' });

  if (await leaderCommunity(req.user.id)) {
    return res.status(409).json({ error: 'You already lead a community' });
  }
  const { rows } = await query(
    `INSERT INTO communities (name, leader_id, district, state, description)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [name, req.user.id, district || null, state || null, description || null]
  );
  res.status(201).json({ community: rows[0] });
}));

/** Full picture for the leader dashboard header: community + roster + project. */
router.get('/mine', requireRole('leader'), wrap(async (req, res) => {
  const community = await leaderCommunity(req.user.id);
  if (!community) return res.json({ community: null, roster: [], application: null, project: null });

  const roster = await many(
    `SELECT cm.id, cm.status, cm.invited_at, cm.responded_at,
            u.id AS user_id, u.username, u.full_name, u.village, u.phone
       FROM community_members cm
       JOIN users u ON u.id = cm.user_id
      WHERE cm.community_id = $1 AND cm.status <> 'declined'
      ORDER BY cm.status, u.full_name`,
    [community.id]
  );
  const application = await one(
    'SELECT * FROM applications WHERE community_id = $1 ORDER BY created_at DESC LIMIT 1',
    [community.id]
  );
  const project = await one(
    'SELECT * FROM projects WHERE community_id = $1 ORDER BY created_at DESC LIMIT 1',
    [community.id]
  );
  res.json({ community, roster, application, project, maxMembers: MAX_MEMBERS });
}));

/** Username search used by the "add member" box. */
router.get('/search-members', requireRole('leader'), wrap(async (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  if (q.length < 2) return res.json({ results: [] });

  const results = await many(
    `SELECT u.id, u.username, u.full_name, u.village,
            EXISTS (SELECT 1 FROM community_members cm
                     WHERE cm.user_id = u.id AND cm.status IN ('pending','active')) AS unavailable
       FROM users u
      WHERE u.role = 'member' AND (u.username LIKE $1 OR lower(u.full_name) LIKE $1)
      ORDER BY u.username
      LIMIT 8`,
    [`%${q}%`]
  );
  res.json({ results });
}));

router.post('/invite', requireRole('leader'), wrap(async (req, res) => {
  const community = await leaderCommunity(req.user.id);
  if (!community) return res.status(400).json({ error: 'Create your community first' });

  const { userId } = req.body;
  const target = await one("SELECT id, role FROM users WHERE id = $1", [userId]);
  if (!target || target.role !== 'member') {
    return res.status(400).json({ error: 'That account is not a community member account' });
  }

  const counted = await one(
    `SELECT COUNT(*)::int AS n FROM community_members
      WHERE community_id = $1 AND status IN ('pending','active')`,
    [community.id]
  );
  if (counted.n >= MAX_MEMBERS) {
    return res.status(400).json({ error: `A community can hold at most ${MAX_MEMBERS} members` });
  }

  const busy = await one(
    "SELECT 1 FROM community_members WHERE user_id = $1 AND status IN ('pending','active')",
    [userId]
  );
  if (busy) return res.status(409).json({ error: 'This person already has a pending or accepted invitation' });

  const { rows } = await query(
    `INSERT INTO community_members (community_id, user_id) VALUES ($1,$2)
     ON CONFLICT (community_id, user_id)
     DO UPDATE SET status = 'pending', invited_at = now(), responded_at = NULL
     RETURNING *`,
    [community.id, userId]
  );
  res.status(201).json({ invite: rows[0] });
}));

router.delete('/members/:userId', requireRole('leader'), wrap(async (req, res) => {
  const community = await leaderCommunity(req.user.id);
  if (!community) return res.status(404).json({ error: 'No community found' });

  const project = await one('SELECT id FROM projects WHERE community_id = $1', [community.id]);
  if (project) return res.status(400).json({ error: 'Members cannot be removed once the project is live' });

  await query('DELETE FROM community_members WHERE community_id = $1 AND user_id = $2',
    [community.id, req.params.userId]);
  res.json({ ok: true });
}));

// ---------------------------------------------------------------- member side
router.get('/invitations', requireRole('member'), wrap(async (req, res) => {
  const invitations = await many(
    `SELECT cm.id, cm.status, cm.invited_at, c.id AS community_id, c.name, c.district, c.state,
            u.full_name AS leader_name, u.username AS leader_username
       FROM community_members cm
       JOIN communities c ON c.id = cm.community_id
       JOIN users u ON u.id = c.leader_id
      WHERE cm.user_id = $1 AND cm.status = 'pending'
      ORDER BY cm.invited_at DESC`,
    [req.user.id]
  );
  res.json({ invitations });
}));

router.post('/invitations/:id/respond', requireRole('member'), wrap(async (req, res) => {
  const accept = req.body.accept === true;
  const invite = await one(
    "SELECT * FROM community_members WHERE id = $1 AND user_id = $2 AND status = 'pending'",
    [req.params.id, req.user.id]
  );
  if (!invite) return res.status(404).json({ error: 'Invitation not found' });

  if (accept) {
    const already = await one(
      "SELECT 1 FROM community_members WHERE user_id = $1 AND status = 'active'",
      [req.user.id]
    );
    if (already) return res.status(409).json({ error: 'You are already part of a community' });
  }

  await query(
    'UPDATE community_members SET status = $1, responded_at = now() WHERE id = $2',
    [accept ? 'active' : 'declined', invite.id]
  );
  res.json({ ok: true, status: accept ? 'active' : 'declined' });
}));

export default router;

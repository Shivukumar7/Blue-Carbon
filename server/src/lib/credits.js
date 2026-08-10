import { query, one } from '../db.js';

export const MEMBER_DAILY_CREDIT = 1;
export const LEADER_DAILY_CREDIT = 2;

/**
 * Recalculates the leader's credit for one project-day.
 * Leader earns LEADER_DAILY_CREDIT x (chunks reported / chunks assigned).
 * Safe to call repeatedly — the row is upserted.
 */
export async function settleLeaderCredit(projectId, date) {
  const stats = await one(
    `SELECT
        c.leader_id,
        (SELECT COUNT(*) FROM chunks WHERE project_id = p.id AND assigned_to IS NOT NULL) AS assigned,
        (SELECT COUNT(*) FROM daily_entries WHERE project_id = p.id AND entry_date = $2) AS reported
     FROM projects p
     JOIN communities c ON c.id = p.community_id
     WHERE p.id = $1`,
    [projectId, date]
  );
  if (!stats || !stats.assigned) return null;

  const participation = Math.min(1, stats.reported / stats.assigned);
  const amount = Number((LEADER_DAILY_CREDIT * participation).toFixed(3));

  await query(
    `INSERT INTO credits (user_id, project_id, role, credit_date, amount, participation_rate)
     VALUES ($1, $2, 'leader', $3, $4, $5)
     ON CONFLICT (user_id, credit_date, role)
     DO UPDATE SET amount = EXCLUDED.amount, participation_rate = EXCLUDED.participation_rate`,
    [stats.leader_id, projectId, date, amount, participation]
  );

  return { participation, amount, reported: stats.reported, assigned: stats.assigned };
}

export async function awardMemberCredit(userId, projectId, date) {
  await query(
    `INSERT INTO credits (user_id, project_id, role, credit_date, amount, participation_rate)
     VALUES ($1, $2, 'member', $3, $4, 1)
     ON CONFLICT (user_id, credit_date, role) DO NOTHING`,
    [userId, projectId, date, MEMBER_DAILY_CREDIT]
  );
}

/** Average daily participation across the whole life of a project (0..1). */
export async function projectParticipation(projectId) {
  const row = await one(
    `SELECT COALESCE(AVG(participation_rate), 0) AS avg_rate
       FROM credits WHERE project_id = $1 AND role = 'leader'`,
    [projectId]
  );
  return row ? Number(row.avg_rate) : 0;
}

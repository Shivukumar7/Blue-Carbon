import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import multer from 'multer';
import { query, one, many } from '../db.js';
import { authenticate, requireRole, wrap } from '../lib/auth.js';
import { awardMemberCredit, settleLeaderCredit } from '../lib/credits.js';

const router = Router();
router.use(authenticate, requireRole('member'));

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
      const ext = (path.extname(file.originalname) || '.jpg').toLowerCase();
      cb(null, `chunk-${req.user.id}-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!/^image\/(jpeg|png|webp|heic)$/.test(file.mimetype)) {
      return cb(Object.assign(new Error('Upload a JPG, PNG or WebP photo'), { status: 400 }));
    }
    cb(null, true);
  },
});

/** Today's date in the server's local timezone as YYYY-MM-DD. */
function todayISO() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

async function myChunk(userId) {
  return one(
    `SELECT ch.*, p.id AS project_id, p.code, p.name AS project_name, p.ecosystem,
            p.boundary, p.start_date, p.duration_years, p.area_hectares AS project_area,
            c.name AS community_name, u.full_name AS leader_name, u.phone AS leader_phone
       FROM chunks ch
       JOIN projects p ON p.id = ch.project_id
       JOIN communities c ON c.id = p.community_id
       JOIN users u ON u.id = c.leader_id
      WHERE ch.assigned_to = $1
      ORDER BY p.created_at DESC LIMIT 1`,
    [userId]
  );
}

router.get('/home', wrap(async (req, res) => {
  const chunk = await myChunk(req.user.id);

  const totals = await one(
    `SELECT COALESCE(SUM(amount),0) AS credits, COUNT(*)::int AS active_days
       FROM credits WHERE user_id = $1 AND role = 'member'`,
    [req.user.id]
  );

  if (!chunk) {
    const membership = await one(
      `SELECT c.name AS community_name, cm.status, a.status AS application_status
         FROM community_members cm
         JOIN communities c ON c.id = cm.community_id
         LEFT JOIN applications a ON a.community_id = c.id
        WHERE cm.user_id = $1 AND cm.status = 'active' LIMIT 1`,
      [req.user.id]
    );
    return res.json({ chunk: null, membership, totals, today: todayISO() });
  }

  const today = todayISO();
  const todayEntry = await one(
    'SELECT * FROM daily_entries WHERE chunk_id = $1 AND entry_date = $2',
    [chunk.id, today]
  );
  const history = await many(
    `SELECT id, entry_date::text AS entry_date, photo_path, temperature_c, humidity_pct,
            soil_moisture_pct, soil_ph, salinity_ppt, saplings_planted, watered, notes
       FROM daily_entries WHERE chunk_id = $1 ORDER BY entry_date DESC LIMIT 30`,
    [chunk.id]
  );

  // Consecutive-day streak, counting back from today (or yesterday if not yet filed).
  const dates = new Set(history.map((h) => h.entry_date));
  let streak = 0;
  const cursor = new Date(`${today}T00:00:00`);
  if (!dates.has(today)) cursor.setDate(cursor.getDate() - 1);
  for (;;) {
    const iso = cursor.toISOString().slice(0, 10);
    if (!dates.has(iso)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  res.json({ chunk, todayEntry, history, totals, streak, today });
}));

router.post('/entries', upload.single('photo'), wrap(async (req, res) => {
  const chunk = await myChunk(req.user.id);
  if (!chunk) return res.status(400).json({ error: 'You have not been assigned a parcel yet' });
  if (!req.file) return res.status(400).json({ error: 'A photo of your parcel is required' });

  const today = todayISO();
  const existing = await one(
    'SELECT id FROM daily_entries WHERE chunk_id = $1 AND entry_date = $2',
    [chunk.id, today]
  );
  if (existing) {
    fs.unlink(req.file.path, () => {});
    return res.status(409).json({ error: "Today's reading has already been submitted" });
  }

  const num = (v) => (v === undefined || v === '' ? null : Number(v));
  const temperature = num(req.body.temperatureC);
  const humidity = num(req.body.humidityPct);
  const soilMoisture = num(req.body.soilMoisturePct);

  const invalid =
    !Number.isFinite(temperature) || temperature < -10 || temperature > 60 ||
    !Number.isFinite(humidity) || humidity < 0 || humidity > 100 ||
    !Number.isFinite(soilMoisture) || soilMoisture < 0 || soilMoisture > 100;

  if (invalid) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({
      error: 'Enter temperature (-10 to 60 C), humidity (0-100%) and soil moisture (0-100%)',
    });
  }

  const { rows } = await query(
    `INSERT INTO daily_entries (chunk_id, project_id, user_id, entry_date, photo_path,
        temperature_c, humidity_pct, soil_moisture_pct, soil_ph, salinity_ppt,
        saplings_planted, watered, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
    [chunk.id, chunk.project_id, req.user.id, today, `/uploads/${req.file.filename}`,
      temperature, humidity, soilMoisture, num(req.body.soilPh), num(req.body.salinityPpt),
      Number(req.body.saplingsPlanted) || 0, req.body.watered !== 'false',
      req.body.notes || null]
  );

  await awardMemberCredit(req.user.id, chunk.project_id, today);
  const leaderSettlement = await settleLeaderCredit(chunk.project_id, today);

  res.status(201).json({ entry: rows[0], creditAwarded: 1, leaderSettlement });
}));

router.get('/credits', wrap(async (req, res) => {
  const ledger = await many(
    `SELECT credit_date::text AS date, amount FROM credits
      WHERE user_id = $1 AND role = 'member' ORDER BY credit_date DESC LIMIT 60`,
    [req.user.id]
  );
  const total = ledger.reduce((sum, r) => sum + Number(r.amount), 0);
  res.json({ ledger, total });
}));

export default router;

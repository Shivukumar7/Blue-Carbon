import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { pool, query, one } from '../db.js';
import { hashPassword } from '../lib/auth.js';
import { splitIntoChunks, hectares, SEQUESTRATION_RATES } from '../lib/geo.js';
import { settleLeaderCredit } from '../lib/credits.js';

const PASSWORD = 'password123';

// A stretch of tidal flat in the Sundarbans delta, West Bengal.
const SUNDARBANS = {
  type: 'Polygon',
  coordinates: [[
    [88.6020, 21.9080], [88.6112, 21.9086], [88.6135, 21.9032],
    [88.6098, 21.8975], [88.6009, 21.8988], [88.5985, 21.9040],
    [88.6020, 21.9080],
  ]],
};

// A second site near Bhitarkanika, Odisha — left pending for the admin demo.
const BHITARKANIKA = {
  type: 'Polygon',
  coordinates: [[
    [86.9020, 20.7180], [86.9125, 20.7192], [86.9150, 20.7120],
    [86.9080, 20.7068], [86.8995, 20.7095], [86.8985, 20.7145],
    [86.9020, 20.7180],
  ]],
};

const MEMBER_NAMES = [
  ['aparna.d', 'Aparna Das', 'Gosaba'],
  ['sujit.m', 'Sujit Mondal', 'Gosaba'],
  ['rekha.b', 'Rekha Barman', 'Pakhirala'],
  ['nirmal.s', 'Nirmal Sardar', 'Pakhirala'],
  ['pratima.h', 'Pratima Halder', 'Dayapur'],
  ['bikash.n', 'Bikash Naskar', 'Dayapur'],
  ['jhuma.p', 'Jhuma Patra', 'Satjelia'],
  ['tapan.r', 'Tapan Roy', 'Satjelia'],
  ['mousumi.g', 'Mousumi Ghosh', 'Satjelia'],
  ['debu.k', 'Debabrata Kayal', 'Rangabelia'],
];

const OTHER_MEMBERS = [
  ['santosh.j', 'Santosh Jena', 'Rajnagar'],
  ['lipika.s', 'Lipika Swain', 'Rajnagar'],
  ['harish.b', 'Harish Behera', 'Kanika'],
  ['sarita.m', 'Sarita Mallick', 'Kanika'],
  ['ranjan.p', 'Ranjan Pradhan', 'Dangamal'],
  ['bimal.o', 'Bimal Ojha', 'Dangamal'],
];

function isoDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

async function createUser({ username, email, fullName, role, village, phone }) {
  const existing = await one('SELECT * FROM users WHERE username = $1', [username]);
  if (existing) return existing;
  const { rows } = await query(
    `INSERT INTO users (username, email, password_hash, full_name, phone, role, village)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [username, email, await hashPassword(PASSWORD), fullName, phone, role, village]
  );
  return rows[0];
}

/** A neutral stand-in image so seeded entries have something to render. */
function writePlaceholderPhoto() {
  const dir = path.resolve(process.cwd(), 'uploads');
  fs.mkdirSync(dir, { recursive: true });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#7dd3c0"/><stop offset="0.55" stop-color="#2f6f5e"/>
    <stop offset="1" stop-color="#123b32"/></linearGradient></defs>
  <rect width="800" height="600" fill="url(#s)"/>
  <g fill="#0d2b25" opacity="0.85">
    <path d="M0 470 q 60 -50 130 -10 t 140 10 t 150 -20 t 160 20 t 220 -10 V600 H0Z"/>
  </g>
  <g stroke="#0f3a30" stroke-width="7" stroke-linecap="round" fill="none" opacity="0.9">
    <path d="M180 470 V400 M180 430 l -30 -30 M180 425 l 28 -28"/>
    <path d="M400 480 V395 M400 425 l -34 -32 M400 435 l 32 -30"/>
    <path d="M620 470 V405 M620 435 l -28 -28 M620 428 l 30 -28"/>
  </g>
  <text x="400" y="560" font-family="system-ui,sans-serif" font-size="26" fill="#cdece2"
        text-anchor="middle" opacity="0.9">Sample field photo</text>
</svg>`;
  fs.writeFileSync(path.join(dir, 'sample-parcel.svg'), svg);
  return '/uploads/sample-parcel.svg';
}

async function main() {
  const photo = writePlaceholderPhoto();

  // ---------------------------------------------------------------- accounts
  await createUser({
    username: 'admin', email: 'registry@moes.gov.in', fullName: 'Dr. Meera Iyer',
    role: 'admin', village: null, phone: '+91 98300 00001',
  });

  const leader = await createUser({
    username: 'leader', email: 'ashoke@gosaba.in', fullName: 'Ashoke Mondal',
    role: 'leader', village: 'Gosaba', phone: '+91 98300 11111',
  });

  const members = [];
  for (const [username, fullName, village] of MEMBER_NAMES) {
    members.push(await createUser({
      username, email: `${username}@example.in`, fullName, role: 'member', village,
      phone: '+91 90000 00000',
    }));
  }

  // ------------------------------------------------------- live demo project
  let community = await one('SELECT * FROM communities WHERE leader_id = $1', [leader.id]);
  if (!community) {
    community = (await query(
      `INSERT INTO communities (name, leader_id, district, state, description)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [ 'Gosaba Tidal Collective', leader.id, 'South 24 Parganas', 'West Bengal',
        'Ten households restoring degraded tidal flats on the eastern bank of the Bidya river.' ]
    )).rows[0];
  }

  for (const m of members) {
    await query(
      `INSERT INTO community_members (community_id, user_id, status, responded_at)
       VALUES ($1,$2,'active',now()) ON CONFLICT DO NOTHING`,
      [community.id, m.id]
    );
  }

  let project = await one('SELECT * FROM projects WHERE community_id = $1', [community.id]);
  if (!project) {
    const areaHa = Number(hectares(SUNDARBANS).toFixed(3));
    const application = (await query(
      `INSERT INTO applications (community_id, title, ecosystem, proposed_area, area_hectares,
                                 member_count, notes, status, visit_date, reviewed_at)
       VALUES ($1,$2,'mangrove',$3,$4,$5,$6,'approved',$7,now()) RETURNING *`,
      [ community.id, 'Bidya East mangrove restoration', SUNDARBANS, areaHa, members.length,
        'Degraded tidal flat, no current use. Community requests Avicennia and Rhizophora saplings.',
        isoDaysAgo(45) ]
    )).rows[0];

    project = (await query(
      `INSERT INTO projects (application_id, community_id, code, name, ecosystem, boundary,
                             area_hectares, sequestration_rate, start_date, duration_years)
       VALUES ($1,$2,'BCR-2026-0001',$3,'mangrove',$4,$5,$6,$7,2) RETURNING *`,
      [ application.id, community.id, 'Bidya East mangrove restoration', SUNDARBANS, areaHa,
        SEQUESTRATION_RATES.mangrove, isoDaysAgo(40) ]
    )).rows[0];

    const parcels = splitIntoChunks(SUNDARBANS, members.length);
    for (let i = 0; i < parcels.length; i += 1) {
      const p = parcels[i];
      await query(
        `INSERT INTO chunks (project_id, label, geometry, centroid_lat, centroid_lng,
                             area_hectares, assigned_to)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [project.id, p.label, p.geometry, p.centroid_lat, p.centroid_lng, p.area_hectares, members[i].id]
      );
    }
    console.log(`Created project ${project.code} with ${parcels.length} parcels.`);
  }

  // --------------------------------------------- 30 days of monitoring data
  const chunks = await pool.query('SELECT * FROM chunks WHERE project_id = $1 ORDER BY label', [project.id]);
  const already = await one('SELECT COUNT(*)::int AS n FROM daily_entries WHERE project_id = $1', [project.id]);

  if (!already.n) {
    for (let day = 29; day >= 0; day -= 1) {
      const date = isoDaysAgo(day);
      for (let i = 0; i < chunks.rows.length; i += 1) {
        // Deterministic gaps so participation is realistic (~85%) rather than perfect.
        const skip = (day * 7 + i * 3) % 13 < 2;
        if (skip) continue;
        const chunk = chunks.rows[i];
        const wobble = ((day * 13 + i * 7) % 11) / 10;
        await query(
          `INSERT INTO daily_entries (chunk_id, project_id, user_id, entry_date, photo_path,
             temperature_c, humidity_pct, soil_moisture_pct, soil_ph, salinity_ppt,
             saplings_planted, watered, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true,$12)
           ON CONFLICT DO NOTHING`,
          [ chunk.id, project.id, chunk.assigned_to, date, photo,
            (28.4 + wobble).toFixed(2), (74 + wobble * 6).toFixed(2), (46 + wobble * 9).toFixed(2),
            (7.1 + wobble * 0.3).toFixed(2), (18 + wobble * 3).toFixed(2),
            day > 24 ? 6 : 0, day % 6 === 0 ? 'Tide reached the seaward edge this morning.' : null ]
        );
        await query(
          `INSERT INTO credits (user_id, project_id, role, credit_date, amount, participation_rate)
           VALUES ($1,$2,'member',$3,1,1) ON CONFLICT DO NOTHING`,
          [chunk.assigned_to, project.id, date]
        );
      }
      await settleLeaderCredit(project.id, date);
    }
    console.log('Seeded 30 days of monitoring entries and credits.');
  }

  // --------------------------------------------------- open marketplace lot
  const listing = await one('SELECT * FROM listings WHERE project_id = $1', [project.id]);
  if (!listing) {
    await query(
      `INSERT INTO listings (project_id, tonnes_available, price_per_tonne, vintage_year)
       VALUES ($1,$2,$3,$4)`,
      [project.id, 148.5, 1450, new Date().getFullYear()]
    );
    console.log('Listed verified tonnes on the marketplace.');
  }

  // ------------------------------------- second community, awaiting approval
  const leader2 = await createUser({
    username: 'leader2', email: 'sabita@bhitarkanika.in', fullName: 'Sabita Nayak',
    role: 'leader', village: 'Rajnagar', phone: '+91 94370 22222',
  });
  let community2 = await one('SELECT * FROM communities WHERE leader_id = $1', [leader2.id]);
  if (!community2) {
    community2 = (await query(
      `INSERT INTO communities (name, leader_id, district, state, description)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [ 'Rajnagar Mangrove Sangha', leader2.id, 'Kendrapara', 'Odisha',
        'Six fisher households adjacent to the Bhitarkanika buffer zone.' ]
    )).rows[0];

    for (const [username, fullName, village] of OTHER_MEMBERS) {
      const u = await createUser({
        username, email: `${username}@example.in`, fullName, role: 'member', village,
        phone: '+91 90000 00000',
      });
      await query(
        `INSERT INTO community_members (community_id, user_id, status, responded_at)
         VALUES ($1,$2,'active',now()) ON CONFLICT DO NOTHING`,
        [community2.id, u.id]
      );
    }

    await query(
      `INSERT INTO applications (community_id, title, ecosystem, proposed_area, area_hectares,
                                 member_count, notes, status)
       VALUES ($1,$2,'mangrove',$3,$4,$5,$6,'submitted')`,
      [ community2.id, 'Rajnagar creek-side restoration', BHITARKANIKA,
        Number(hectares(BHITARKANIKA).toFixed(3)), OTHER_MEMBERS.length,
        'Abandoned shrimp pond embankments; community wants to restore natural creek flow.' ]
    );
    console.log('Created a pending application for the admin demo.');
  }

  // A member account with no community yet, to demo the invitation flow.
  await createUser({
    username: 'newmember', email: 'newmember@example.in', fullName: 'Ritesh Kar',
    role: 'member', village: 'Gosaba', phone: '+91 90000 12345',
  });

  console.log(`
Seed complete. All accounts use the password: ${PASSWORD}

  admin      -> Government registry officer
  leader     -> Gosaba Tidal Collective (live project, 30 days of data)
  leader2    -> Rajnagar Mangrove Sangha (application awaiting approval)
  aparna.d   -> member with an assigned parcel
  newmember  -> member with no community (test the invite flow)
`);
  await pool.end();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

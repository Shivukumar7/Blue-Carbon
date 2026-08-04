import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../db.js';

const here = path.dirname(fileURLToPath(import.meta.url));

const DROP = `
DROP TABLE IF EXISTS orders, listings, credits, daily_entries, chunks, projects,
  applications, community_members, communities, users CASCADE;
`;

async function main() {
  if (process.argv.includes('--drop')) {
    console.log('Dropping existing tables...');
    await pool.query(DROP);
  }
  const sql = fs.readFileSync(path.join(here, '..', 'schema.sql'), 'utf8');
  await pool.query(sql);
  console.log('Schema is up to date.');
  await pool.end();
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});

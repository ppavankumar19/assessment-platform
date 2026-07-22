/**
 * Migration runner — applies pending SQL migration files to Supabase.
 *
 * Uses the Supabase Management API (no pg driver, no CLI login needed).
 * Requires a Personal Access Token from:
 *   https://supabase.com/dashboard/account/tokens
 *
 * Usage:
 *   node --env-file=backend/.env scripts/migrate.mjs
 *
 * Environment variables (in backend/.env):
 *   SUPABASE_URL             — your project URL
 *   SUPABASE_ACCESS_TOKEN    — Personal Access Token from Supabase dashboard
 */

import { readdir, readFile } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))

const SUPABASE_URL    = process.env.SUPABASE_URL
const ACCESS_TOKEN    = process.env.SUPABASE_ACCESS_TOKEN

if (!SUPABASE_URL || !ACCESS_TOKEN) {
  console.error('\nMissing required environment variables:')
  if (!SUPABASE_URL)     console.error('  SUPABASE_URL')
  if (!ACCESS_TOKEN)     console.error('  SUPABASE_ACCESS_TOKEN  (get from https://supabase.com/dashboard/account/tokens)')
  console.error('\nAdd them to backend/.env and retry.\n')
  process.exit(1)
}

// Extract project ref from URL: https://<ref>.supabase.co
const PROJECT_REF = new URL(SUPABASE_URL).hostname.split('.')[0]
const API_BASE    = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database`

// ── Run SQL via Supabase Management API ─────────────────────────────────────

async function runSQL(sql) {
  const res = await fetch(`${API_BASE}/query`, {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({ query: sql }),
  })
  const body = await res.json()
  if (!res.ok) {
    throw new Error(body?.message || body?.error || JSON.stringify(body))
  }
  return body
}

// ── Bootstrap migrations tracking table ──────────────────────────────────────

await runSQL(`
  CREATE TABLE IF NOT EXISTS _migrations (
    id         SERIAL      PRIMARY KEY,
    filename   TEXT        UNIQUE NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`)

// ── Load already-applied migrations ─────────────────────────────────────────

const applied = await runSQL('SELECT filename FROM _migrations ORDER BY filename')
const appliedSet = new Set((applied || []).map(r => r.filename))

// ── Discover migration files ─────────────────────────────────────────────────

const migrationsDir = join(__dir, '..', 'supabase', 'migrations')
const files = (await readdir(migrationsDir))
  .filter(f => f.endsWith('.sql'))
  .sort()

const pending = files.filter(f => !appliedSet.has(f))

if (pending.length === 0) {
  console.log('All migrations are already applied. Nothing to do.')
  process.exit(0)
}

console.log(`Found ${pending.length} pending migration${pending.length > 1 ? 's' : ''}:\n`)

// ── Apply each pending migration ─────────────────────────────────────────────

for (const file of pending) {
  process.stdout.write(`  Applying ${file} ... `)
  const sql = await readFile(join(migrationsDir, file), 'utf8')

  try {
    await runSQL(sql)
    await runSQL(`INSERT INTO _migrations (filename) VALUES ('${file.replace(/'/g, "''")}')`)
    console.log('done')
  } catch (err) {
    console.log('FAILED')
    console.error(`\n  Error: ${err.message}\n`)
    console.error('  Fix the migration file and re-run. Migrations after this one were skipped.')
    process.exit(1)
  }
}

console.log('\nAll migrations applied successfully.')

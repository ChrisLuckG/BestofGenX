#!/usr/bin/env node
/**
 * Vercel Deployment Cleanup Script
 * Keeps the latest N deployments and deletes the rest.
 *
 * Usage:
 *   node scripts/cleanup-deployments.js
 *
 * Required env vars:
 *   VERCEL_TOKEN   - Vercel API token (Settings → Tokens)
 *   VERCEL_PROJECT_ID  - Project ID from Vercel project settings
 *   VERCEL_TEAM_ID     - (optional) Team ID if project is in a team
 *
 * Or run directly:
 *   VERCEL_TOKEN=xxx VERCEL_PROJECT_ID=yyy node scripts/cleanup-deployments.js
 */

const KEEP = 5; // How many deployments to keep

const TOKEN = process.env.VERCEL_TOKEN;
const PROJECT_ID = process.env.VERCEL_PROJECT_ID;
const TEAM_ID = process.env.VERCEL_TEAM_ID;

if (!TOKEN || !PROJECT_ID) {
  console.error('❌  Missing VERCEL_TOKEN or VERCEL_PROJECT_ID');
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  'Content-Type': 'application/json',
};

const teamQuery = TEAM_ID ? `&teamId=${TEAM_ID}` : '';

async function fetchDeployments() {
  const url = `https://api.vercel.com/v6/deployments?projectId=${PROJECT_ID}&limit=100&target=production${teamQuery}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`List failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.deployments ?? [];
}

async function deleteDeployment(id) {
  const url = `https://api.vercel.com/v13/deployments/${id}${TEAM_ID ? `?teamId=${TEAM_ID}` : ''}`;
  const res = await fetch(url, { method: 'DELETE', headers });
  if (!res.ok) {
    const body = await res.text();
    console.warn(`  ⚠️  Could not delete ${id}: ${res.status} ${body}`);
    return false;
  }
  return true;
}

async function main() {
  console.log('🔍  Fetching production deployments...');
  const deployments = await fetchDeployments();

  // Sort newest first (they should already be, but be safe)
  deployments.sort((a, b) => b.createdAt - a.createdAt);

  const keep = deployments.slice(0, KEEP);
  const toDelete = deployments.slice(KEEP);

  console.log(`✅  Total: ${deployments.length}  |  Keeping: ${keep.length}  |  Deleting: ${toDelete.length}`);

  if (toDelete.length === 0) {
    console.log('Nothing to delete.');
    return;
  }

  for (const dep of toDelete) {
    const date = new Date(dep.createdAt).toISOString().slice(0, 16).replace('T', ' ');
    process.stdout.write(`  🗑️  Deleting ${dep.uid}  (${date})... `);
    const ok = await deleteDeployment(dep.uid);
    console.log(ok ? 'done' : 'skipped');
  }

  console.log('✅  Cleanup complete.');
}

main().catch(err => {
  console.error('❌', err.message);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Deploy to Vercel Production and cleanup old deployments
 * Usage: node scripts/deploy-clean.js
 * Or: npm run deploy (if added to package.json)
 */

const { execSync } = require('child_process');

const KEEP_DEPLOYMENTS = 3; // Keep latest 3 deployments

function run(cmd, options = {}) {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: options.silent ? 'pipe' : 'inherit', ...options });
  } catch (e) {
    if (!options.ignoreError) throw e;
    return null;
  }
}

async function main() {
  console.log('\n🚀 Deploying to Vercel Production...\n');
  
  // Deploy to production
  try {
    run('vercel --prod');
  } catch (e) {
    console.error('\n❌ Deployment failed!');
    process.exit(1);
  }
  
  console.log('\n🧹 Cleaning up old deployments...\n');
  
  // Get all deployments (parse text output)
  const output = run('vercel ls', { silent: true, ignoreError: true });
  
  if (!output) {
    console.log('⚠️  Could not list deployments');
    return;
  }
  
  // Parse the text output - extract URLs from lines
  // Format: "  3d      https://sporttock-xxx.vercel.app     ● Ready ..."
  const urlMatches = output.match(/https:\/\/sporttock[^\s]+\.vercel\.app/g) || [];
  
  console.log(`  Found ${urlMatches.length} deployments, keeping ${KEEP_DEPLOYMENTS}`);
  
  // Keep latest N, delete the rest
  const toDelete = urlMatches.slice(KEEP_DEPLOYMENTS);
  
  let deleted = 0;
  for (const url of toDelete) {
    console.log(`  Removing: ${url}`);
    run(`vercel rm ${url} --yes`, { silent: true, ignoreError: true });
    deleted++;
  }
  
  if (deleted > 0) {
    console.log(`\n✅ Deleted ${deleted} old deployment(s)`);
  } else {
    console.log('✅ No old deployments to clean up');
  }
  
  console.log('\n✨ Done!\n');
}

main().catch(console.error);

// Badges / labels / filter chips use the house rounding (rounded-sm, like CategoryBadge) - not pills.
// rounded-full is for circles only: avatars, dots, round icon buttons and the small count bubbles.
// Fails for a line outside the admin that draws a small padded label with rounded-full.
//   npx tsx scripts/check-badge-rounding.ts
import fs from 'fs';
import path from 'path';

const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const files = [...walk('src/components'), ...walk('src/app')].filter(f => f.endsWith('.tsx') && !/[\\/]admin[\\/]/.test(f));
const bad: string[] = [];
for (const f of files) {
  fs.readFileSync(f, 'utf8').split('\n').forEach((l, i) => {
    if (!/rounded-full/.test(l)) return;
    if (/\b(w|h|min-w|min-h)-\[?\d/.test(l) && /\b(h-|min-w-)/.test(l)) return; // circles and count bubbles have a fixed size
    const padded = /\bpx-[\d.]+/.test(l) && /\bpy-[\d.]+/.test(l);
    const label = /text-\[(7|8|9|10|11|12)px\]|text-xs|text-sm|text-base|uppercase|tracking-/.test(l);
    if (padded && label) bad.push(`${f.replace(/\\/g, '/')}:${i + 1}`);
  });
}
console.log(`     (${files.length} files scanned)`);
if (bad.length) { console.log('FAIL pill-shaped badges (use rounded-sm):\n  ' + bad.join('\n  ')); process.exit(1); }
console.log('ok   no pill-shaped badges\n\nall ok');

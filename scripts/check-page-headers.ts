// Every page uses THE page header (src/components/PageHeader.tsx) - so a new or forgotten page
// cannot quietly come with its own. The Profile page and the static pages (Contact, Imprint ...)
// each had their own header until 18.10.2026, and it was noticed one page at a time.
//
// Fails when
//  - a page component (any *Page*.tsx under src/components, plus the screens listed in EXTRA)
//    does not use PageHeader and is not in ALLOW with a reason
//  - a file hand-copies the header's look (its title class) instead of using the component
//  - an ALLOW entry no longer exists (the list must not rot)
// Static scan, no server needed:   npx tsx scripts/check-page-headers.ts
import fs from 'fs';
import path from 'path';

let failed = 0;
const eq = (n: string, got: unknown, want: unknown) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) failed++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${ok ? '' : `\n       got  ${JSON.stringify(got)}\n       want ${JSON.stringify(want)}`}`); };

const ROOT = 'src/components';
const walk = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
const rel = (f: string) => f.replace(/\\/g, '/');

/** Screens that are pages but not named *Page*. */
const EXTRA = ['src/components/PlayerCard.tsx', 'src/components/StaticPageInline.tsx'];

/** Pages that deliberately have NO shared header - each with the reason. */
const ALLOW: Record<string, string> = {
  'src/components/LoginPage.tsx': 'login / sign-up flow, full-screen, its own branding',
  'src/components/desktop/DesktopLoginPage.tsx': 'login / sign-up flow, full-screen, its own branding',
  'src/components/JoinChallengePage.tsx': 'invitation landing page, black full-screen onboarding',
  'src/components/RewardDetailPage.tsx': 'black full-screen reward detail (hero image), opened from Rewards which has the header',
  'src/components/desktop/DesktopBattlesPage.tsx': 'thin wrapper - renders BattlesPage, which has the header',
  'src/components/DynamicPage.tsx': 'public standalone route (/about), outside the app shell',
  'src/components/StaticPageLayout.tsx': 'public standalone routes (/kontakt, /impressum ...), outside the app shell; inside the app those pages are StaticPageInline',
  'src/components/ChallengesPage.tsx': 'unused (imported nowhere)',
  'src/components/ProductDetailPage.tsx': 'unused (imported nowhere)',
};

/** Files allowed to carry the header look by hand - each with the reason. */
const COPY_SIGNATURE = 'font-display text-lg tracking-wider text-gray-900 block leading-none';
const ALLOW_COPIES: Record<string, string> = {
  'src/components/games/SoloTriviaGame.tsx': 'game setup/preparing headers: topic-coloured back button and a loading bar under the header; same geometry as PageHeader',
  'src/components/BattlesPage.tsx': 'battle "preparing" header: back button turns into a spinner while giving up; same geometry as PageHeader',
};

const files = walk(ROOT).filter(f => f.endsWith('.tsx')).map(rel);
const pages = Array.from(new Set([...files.filter(f => /Page[^/]*\.tsx$/.test(path.basename(f)) && !/PageHeader\.tsx$/.test(f)), ...EXTRA]));

// PageTemplate renders PageHeader itself, so a page built on it counts
const missing = pages.filter(f => !ALLOW[f] && !/\b(PageHeader|PageTemplate)\b/.test(fs.readFileSync(f, 'utf8')));
console.log(`     (${pages.length} page components checked, ${Object.keys(ALLOW).length} allowed without the header)`);
eq('every page uses the shared PageHeader (or is listed in ALLOW with a reason)', missing, []);

const copies = files.filter(f => !f.endsWith('PageHeader.tsx') && !ALLOW_COPIES[f] && fs.readFileSync(f, 'utf8').includes(COPY_SIGNATURE));
eq('nobody hand-copies the header look instead of using the component', copies, []);

eq('the ALLOW lists point at files that exist', [...Object.keys(ALLOW), ...Object.keys(ALLOW_COPIES)].filter(f => !fs.existsSync(f)), []);
eq('every ALLOW entry has a reason', Object.entries({ ...ALLOW, ...ALLOW_COPIES }).filter(([, why]) => !why.trim()).map(([f]) => f), []);
eq('an allowed copy is still a copy (otherwise remove it from the list)', Object.keys(ALLOW_COPIES).filter(f => !fs.readFileSync(f, 'utf8').includes(COPY_SIGNATURE)), []);

// the pages this was about
for (const f of ['src/components/ProfilePage.tsx', 'src/components/StaticPageInline.tsx', 'src/components/PlayerCard.tsx', 'src/components/AuthorPage.tsx', 'src/components/PageTemplate.tsx', 'src/components/ArticlePage.tsx']) {
  eq(`${path.basename(f)} renders <PageHeader`, fs.readFileSync(f, 'utf8').includes('<PageHeader'), true);
}

console.log(failed ? `\n${failed} FAILED` : '\nall ok');
process.exit(failed ? 1 : 0);

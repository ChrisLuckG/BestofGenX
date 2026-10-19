// Every dialog uses THE modal shell (src/components/BrandedModal.tsx: coloured band left, content right -
// like Login / Logout / Not-enough-coins), directly or through BrandedConfirmModal / ConfirmModal / AlertModal.
// Dialogs that drew their own white box crept back one at a time (18.10.2026: "Cancel Battle?").
//
// Fails when a file outside the admin draws a full-screen overlay with its own dialog box
// (fixed inset-0 + a rounded max-w box right after) and is not in ALLOW with a reason.
// Static scan, no server needed:   npx tsx scripts/check-modals.ts
import fs from 'fs';
import path from 'path';

let failed = 0;
const eq = (n: string, got: unknown, want: unknown) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) failed++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${ok ? '' : `\n       got  ${JSON.stringify(got, null, 1)}\n       want ${JSON.stringify(want)}`}`); };

const walk = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
const rel = (f: string) => f.replace(/\\/g, '/');

/** Overlays that are deliberately NOT the branded dialog - each with the reason. */
const ALLOW: Record<string, string> = {
  'src/components/BrandedModal.tsx': 'the shell itself',
  'src/components/LoginPage.tsx': 'the reference design (login / sign-up)',
  'src/components/desktop/DesktopLoginPage.tsx': 'the reference design (login / sign-up)',
  'src/components/LogoutModal.tsx': 'the reference design (logout, with session stats)',
  'src/components/WelcomeBackModal.tsx': 'the reference design (welcome back)',
  'src/components/NotEnoughCoinsCard.tsx': 'the reference design (not enough coins)',
  'src/components/TVPage.tsx': 'video player overlay, not a dialog',
  'src/components/ImageZoomModal.tsx': 'image zoom, not a dialog',
  'src/components/RankingItemImage.tsx': 'image zoom, not a dialog',
  'src/components/desktop/DesktopRankingsPage.tsx': 'shows the Player Profile page in a frame, not a dialog',
  'src/components/WelcomeNewsPanel.tsx': 'side panel, not a dialog',
  'src/components/GameIntroModal.tsx': 'unused (imported nowhere)',
  'src/components/ChallengesPage.tsx': 'unused (imported nowhere)',
};

const files = [...walk('src/components'), ...walk('src/app')].map(rel).filter(f => f.endsWith('.tsx') && !/\/admin\//.test(f));
const offenders: string[] = [];
for (const f of files) {
  if (ALLOW[f]) continue;
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  lines.forEach((l, i) => {
    if (!/fixed inset-0|position: 'fixed', inset: 0/.test(l)) return;
    const next = lines.slice(i, i + 8).join('\n');
    // the frame around the login page is the reference design itself
    if (/<(Desktop)?LoginPage[\s>]/.test(next)) return;
    // an overlay followed by its own box = a hand-made dialog
    if (/rounded-(2xl|3xl)/.test(next) && /max-w-/.test(next)) offenders.push(`${f}:${i + 1}`);
  });
}
console.log(`     (${files.length} files scanned, ${Object.keys(ALLOW).length} allowed)`);
eq('no hand-made dialog boxes outside BrandedModal (or ALLOW with a reason)', offenders, []);
eq('the ALLOW list points at files that exist', Object.keys(ALLOW).filter(f => !fs.existsSync(f)), []);
eq('every ALLOW entry has a reason', Object.entries(ALLOW).filter(([, w]) => !w.trim()).map(([f]) => f), []);

// the dialogs this was about use the shell
for (const f of ['ConfirmModal', 'BrandedConfirmModal', 'LoginRequiredModal', 'SkipPenaltyModal', 'SwipeWarningModal', 'JustForFunModal', 'InviteModal', 'PaymentModal', 'CheckoutSuccessModal', 'PushNotifications', 'battles/InviteFlowModal']) {
  const src = fs.readFileSync(`src/components/${f}.tsx`, 'utf8');
  eq(`${f} uses the branded modal`, /BrandedModal|BrandedConfirmModal/.test(src), true);
}
for (const f of ['BattlesPage', 'ProfilePage', 'NotificationPage', 'CartPage']) {
  const src = fs.readFileSync(`src/components/${f}.tsx`, 'utf8');
  eq(`${f}: its dialogs use the branded modal`, /<Branded(Confirm)?Modal/.test(src), true);
}

console.log(failed ? `\n${failed} FAILED` : '\nall ok');
process.exit(failed ? 1 : 0);

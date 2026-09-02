// Seeds the legal/static pages (imprint, privacy, terms, contact) with English
// baseline content so the footer links never lead to an empty page.
//
// The slugs stay German ('impressum', 'datenschutz', 'agb', 'kontakt') because
// they are the DB keys and the public URLs; only the visible text is English.
//
// Everything written here is a STARTING POINT meant to be edited under
// /admin/pages/<slug>. Passages that legally require company-specific data are
// marked with [PLACEHOLDER - ...] so they cannot be published unnoticed.
//
// Idempotent: re-running overwrites the four pages with these baselines.
// Use --dry to print what would be written without touching the DB.
//
//   npx tsx scripts/seed-static-pages.ts [--dry]

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env.local') });

const TODO = (what: string) =>
  `<div class="mb-6 bg-[#E36B11]/10 border-l-4 border-[#E36B11] p-4 rounded-r-lg"><span class="text-[#E36B11] font-semibold text-sm">⚠️ PLACEHOLDER</span><p class="text-gray-600 text-sm mt-1">${what}</p></div>`;

// No H2 needed - title comes from the layout wrapper
const H3 = (t: string) => `<h3 class="text-base font-bold text-gray-900 mt-8 mb-4 pb-2 border-b border-gray-200">${t}</h3>`;
const P = (t: string) => `<p class="mb-4 text-sm text-gray-700 leading-relaxed">${t}</p>`;
const UL = (items: string[]) =>
  `<ul class="mb-5 text-sm text-gray-700 space-y-2">${items.map(i => `<li class="flex gap-2"><span class="text-[#E36B11]">•</span><span>${i}</span></li>`).join('')}</ul>`;
const MAIL = '<a href="mailto:contact@bestofgenx.com" class="text-[#E36B11] hover:underline font-medium">contact@bestofgenx.com</a>';
const INTRO = (t: string) => `<p class="mb-6 text-sm text-gray-600 italic border-l-2 border-gray-300 pl-4">${t}</p>`;

const IMPRINT = [
  INTRO('Information pursuant to Sec. 5 German Digital Services Act (DDG) and Sec. 18 German State Media Treaty (MStV).'),

  H3('Operator'),
  TODO('legal entity name, legal form, street, postal code, city, country'),
  P('<strong>Best of GenX</strong><br/>80s, 90s &amp; Early 2000s Entertainment'),

  H3('Represented by'),
  TODO('name of the managing director / authorised representative'),

  H3('Contact'),
  P(`Email: ${MAIL}`),
  TODO('telephone number - a reachable phone number or equivalent direct contact channel is mandatory'),

  H3('Register and VAT'),
  TODO('commercial register court and number, VAT identification number pursuant to Sec. 27a German VAT Act - omit only if genuinely not applicable'),

  H3('Responsible for editorial content'),
  TODO('name and full postal address of the person responsible pursuant to Sec. 18 (2) MStV'),

  H3('Dispute resolution'),
  P('We are not obliged and not willing to participate in dispute resolution proceedings before a consumer arbitration board.'),

  H3('Liability for links'),
  P('Our platform contains links to external websites over whose content we have no control. We therefore cannot accept any liability for this third-party content. The respective provider or operator of the linked pages is always responsible for their content.'),

  H3('Copyright'),
  P('The content and works created by the operators on this platform are subject to copyright law. Reproduction, editing, distribution and any kind of use beyond the limits of copyright require our written consent.'),
].join('\n');

const PRIVACY = [
  INTRO('This policy explains what personal data Best of GenX processes, why, on what legal basis, and which rights you have.'),

  H3('1. Controller'),
  TODO('legal entity name and full postal address of the controller'),
  P(`Data protection enquiries: ${MAIL}`),

  H3('2. Data we process'),
  P('<strong>Account data</strong> you provide when registering:'),
  UL([
    'Username and email address',
    'Password (stored only as a salted hash, never in plain text)',
    'Optional profile data: avatar, country, display name, biography, social links, phone number',
  ]),
  P('<strong>Usage data</strong> generated while you use the platform:'),
  UL([
    'Quiz and trivia answers, response times and results',
    'QuizzBattle participation, wagers, wins and losses',
    'BOGX coin balance and the underlying transaction history',
    'Rankings and level progress',
    'Articles you have read and reactions you have given',
    'Song requests and votes you submit',
    'Referral code, number of referrals, and who referred you',
  ]),
  P('<strong>Notification data</strong>, if you opt in:'),
  UL([
    'Web push subscription (browser endpoint and cryptographic keys) - required to deliver push notifications',
    'Your notification preferences per category',
  ]),
  P('<strong>Technical data</strong> processed automatically when you access the platform: IP address, browser type and version, operating system, referring URL, date and time of access.'),
  P('<strong>Order data</strong>, if you redeem or purchase items in the shop: shipping address and order details. Payment card data is entered directly with our payment provider and never reaches our servers.'),

  H3('3. Purposes and legal bases'),
  UL([
    '<strong>Providing the platform, your account, games, rankings and shop</strong> - performance of a contract, Art. 6 (1)(b) GDPR',
    '<strong>Push notifications and email notifications you opted into</strong> - your consent, Art. 6 (1)(a) GDPR, revocable at any time in your notification settings',
    '<strong>Transactional emails</strong> such as email verification and password reset - Art. 6 (1)(b) GDPR',
    '<strong>Security, abuse prevention and fair play</strong> (for example detecting multiple accounts or automated manipulation) - legitimate interest, Art. 6 (1)(f) GDPR',
    '<strong>Processing orders and payments</strong> - Art. 6 (1)(b) GDPR, plus legal retention duties under Art. 6 (1)(c) GDPR',
  ]),

  H3('4. Cookies and local storage'),
  P('We use a session cookie to keep you signed in. This is technically necessary for the platform to function. We additionally store small amounts of non-sensitive data in your browser\'s local storage, for example your last known ranking position so that changes can be highlighted. We do not use advertising or cross-site tracking cookies.'),

  H3('5. Service providers'),
  P('We use the following processors, each bound by a data processing agreement:'),
  UL([
    '<strong>Vercel Inc.</strong> - hosting, delivery and file storage',
    '<strong>MongoDB Atlas</strong> - database hosting',
    '<strong>Cloudinary</strong> - image hosting and transformation',
    '<strong>Stripe</strong> - payment processing',
    '<strong>Printful / Printify</strong> - production and shipping of shop items',
    '<strong>Resend</strong> - delivery of transactional emails',
    '<strong>Google</strong> - optional sign-in via your Google account',
    '<strong>OpenAI</strong> - generation of editorial content; no user account data is sent for this purpose',
  ]),
  P('Embedded third-party content: YouTube videos and Spotify players. When such an embed loads, the respective provider receives your IP address and can set its own cookies. We have no control over that processing.'),

  H3('6. International transfers'),
  P('Some of the providers listed above process data outside the European Economic Area, in particular in the United States. Such transfers are based on the EU standard contractual clauses or on an adequacy decision of the European Commission.'),

  H3('7. Retention'),
  P('We keep account data for as long as your account exists. When you delete your account it is first flagged as deleted and removed from all public views such as rankings, and is then erased. Data subject to statutory retention periods - in particular order and invoice data - is retained for as long as the law requires.'),

  H3('8. Your rights'),
  P('You have the right to access, rectification, erasure, restriction of processing, data portability, and to object to processing based on legitimate interests. Consent you have given can be withdrawn at any time with effect for the future. You also have the right to lodge a complaint with a data protection supervisory authority.'),
  P(`To exercise these rights, contact us at ${MAIL}.`),

  H3('9. Age requirement'),
  P('The platform is not directed at children. You must be at least 16 years old to create an account.'),

  H3('10. Changes'),
  P('We may update this policy to reflect changes to the platform or to legal requirements. Registered users will be informed by email about material changes.'),
].join('\n');

const TERMS = [
  INTRO('By registering and using Best of GenX you accept these terms.'),

  H3('1. Scope'),
  P('These terms govern the use of the Best of GenX platform (the "Platform"). By registering and using the Platform you accept these terms.'),

  H3('2. Our service'),
  P('Best of GenX is an entertainment platform offering:'),
  UL([
    'Quiz and trivia games',
    'Multiplayer QuizzBattles',
    'Rankroll votes and rankings',
    'Articles and editorial content',
    'Curated Spotify playlists and community song requests',
    'A BOGX coin system with virtual and physical rewards',
  ]),
  P('We may add, change or discontinue individual features. There is no entitlement to the continued availability of a particular feature.'),

  H3('3. Registration and account'),
  P('(1) Full use of the Platform requires registration.<br/>(2) You must provide accurate information.<br/>(3) Your account is personal and non-transferable.<br/>(4) You are responsible for keeping your credentials confidential.<br/>(5) You must be at least 16 years old.'),

  H3('4. BOGX coins'),
  P('(1) BOGX coins are earned through activities on the Platform such as playing games, reading articles and voting.<br/>(2) <strong>BOGX coins have no monetary value, are not a means of payment and cannot be exchanged for cash or transferred to third parties.</strong><br/>(3) Coins can be redeemed for rewards in the shop, subject to availability.<br/>(4) In QuizzBattles the wager is deducted when the battle is created or accepted and settled when it ends. A forfeit counts as a loss.<br/>(5) Rankings include automated accounts ("bots") for a livelier competition. These are visible in the leaderboards and never receive real rewards.<br/>(6) We may correct coin balances that resulted from technical errors, and may deduct coins or suspend accounts in the event of breaches of these terms.'),

  H3('5. Shop, rewards and payments'),
  P('(1) Rewards may be redeemed for coins, for money, or for a combination of both.<br/>(2) Payments are processed by our payment provider; their terms apply to the payment transaction.<br/>(3) Physical items are produced and shipped by third-party fulfilment partners. Delivery times are estimates.<br/>(4) Statutory rights of withdrawal for consumers remain unaffected.'),
  TODO('withdrawal policy and delivery/shipping terms for the shop must be added by the operator'),

  H3('6. Rules of conduct'),
  P('When using the Platform it is prohibited to:'),
  UL([
    'Post insulting, racist, discriminatory or otherwise unlawful content',
    'Manipulate the system using bots, scripts or automated tools',
    'Create multiple accounts in order to gain an advantage',
    'Harass or threaten other users',
    'Share copyrighted material without permission',
  ]),

  H3('7. User content'),
  P('If you submit content - for example song requests, votes, comments or profile information - you grant us a non-exclusive, royalty-free right to display and use that content on the Platform. You remain responsible for the content you submit and confirm that you hold the necessary rights.'),

  H3('8. Intellectual property'),
  P('(1) All Platform content (texts, graphics, logos, quiz questions) is protected by copyright.<br/>(2) Use is permitted only within the Platform.<br/>(3) Commercial use requires our prior written consent.'),

  H3('9. Liability'),
  P('(1) The Platform is provided "as is".<br/>(2) We do not warrant uninterrupted availability.<br/>(3) We are liable without limitation for intent and gross negligence, and for injury to life, body or health. For slight negligence we are liable only for breaches of material contractual obligations and only up to the foreseeable damage typical for this type of contract.<br/>(4) We accept no liability for external links.'),

  H3('10. Termination'),
  P('(1) You may delete your account at any time.<br/>(2) We may suspend or terminate accounts that breach these terms.<br/>(3) On deletion, any collected coins expire without compensation.'),

  H3('11. Changes to these terms'),
  P('We may amend these terms. Registered users will be notified by email of material changes. If you do not object within four weeks of notification, the amended terms are deemed accepted.'),

  H3('12. Final provisions'),
  P('(1) German law applies. For consumers, the mandatory consumer protection provisions of their country of residence remain unaffected.<br/>(2) Should individual provisions be invalid, the validity of the remaining provisions is unaffected.'),
  TODO('confirm governing law and place of jurisdiction once the operating entity is registered'),

  H3('Contact'),
  P(`Questions about these terms: ${MAIL}`),
].join('\n');

const CONTACT = [
  INTRO('Questions, feedback, or just want to say hello? We would love to hear from you.'),

  `<div class="bg-[#E36B11] rounded-2xl p-8 text-center mb-8 not-prose shadow-lg">
    <div class="text-white/80 text-sm mb-2">Email us at</div>
    <a href="mailto:contact@bestofgenx.com" class="text-2xl font-bold text-white hover:underline">contact@bestofgenx.com</a>
  </div>`,

  H3('Response time'),
  P('We usually reply within 24 to 48 hours on business days.'),

  H3('What people usually write about'),
  UL([
    '<strong>Account &amp; login</strong> - trouble signing in or with your profile',
    '<strong>Coins &amp; rewards</strong> - questions about BOGX, rankings or the shop',
    '<strong>Song requests</strong> - suggestions for our Spotify playlists',
    '<strong>Bug reports</strong> - something not working as expected',
    '<strong>Press &amp; partnerships</strong> - collaborations and media enquiries',
  ]),

  H3('Legal notices'),
  P('For the operator details required by law, see the <a href="/impressum" class="text-[#E36B11] hover:underline">Imprint</a>. How we handle your data is described in the <a href="/datenschutz" class="text-[#E36B11] hover:underline">Privacy Policy</a>.'),
].join('\n');

const PAGES = [
  { slug: 'impressum', title: 'Imprint', subtitle: 'Legal information about the operator', content: IMPRINT, order: 1 },
  { slug: 'datenschutz', title: 'Privacy Policy', subtitle: 'How we handle your data', content: PRIVACY, order: 2 },
  { slug: 'agb', title: 'Terms & Conditions', subtitle: 'The rules for using Best of GenX', content: TERMS, order: 3 },
  { slug: 'kontakt', title: 'Contact', subtitle: 'How to reach us', content: CONTACT, order: 4 },
];

async function main() {
  const dry = process.argv.includes('--dry');

  if (dry) {
    for (const p of PAGES) {
      const todos = (p.content.match(/\[PLACEHOLDER - [^\]]+\]/g) || []).length;
      console.log(`\n${p.slug.padEnd(12)} "${p.title}"  ${p.content.length} chars, ${todos} placeholder(s)`);
    }
    console.log('\nDry run - nothing written.');
    return;
  }

  await mongoose.connect(process.env.MONGODB_URI || '');
  const pages = mongoose.connection.collection('pages');

  for (const p of PAGES) {
    const now = new Date();
    const res = await pages.updateOne(
      { slug: p.slug },
      {
        $set: { ...p, status: 'published', updatedAt: now },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true }
    );
    const action = res.upsertedCount ? 'created' : 'updated';
    const todos = (p.content.match(/\[PLACEHOLDER - [^\]]+\]/g) || []).length;
    console.log(`${action.padEnd(8)} ${p.slug.padEnd(12)} ${todos} placeholder(s) left to fill`);
  }

  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

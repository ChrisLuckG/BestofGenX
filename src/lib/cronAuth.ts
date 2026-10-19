import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';

/**
 * Guard for the cron routes that something OUTSIDE Vercel calls.
 *
 * Vercel's Hobby plan only runs crons once a day, so Daily Auto (every 5 minutes) and the
 * new-article push are triggered by a GitHub Actions workflow (a copy lives in
 * ops/bogx-cron/.github/workflows/cron.yml, deployed to its own small public repository) that
 * sends `Authorization: Bearer $CRON_SECRET`. The workflow repository is public and so is the live
 * site: the secret is the only protection against anybody starting a generation (which costs
 * money) by opening a URL.
 *
 * Fails CLOSED in production: no CRON_SECRET configured = nobody may run it. (The older cron
 * routes check the header but let the request through anyway; these two must not.)
 * In local development without a secret the route stays open, like the rest of the dev setup.
 */
export function cronAuthError(request: Request, env: { CRON_SECRET?: string; NODE_ENV?: string } = process.env): NextResponse | null {
  const secret = env.CRON_SECRET;
  if (!secret) {
    return env.NODE_ENV === 'production'
      ? NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 503 })
      : null;
  }
  const sent = Buffer.from(request.headers.get('authorization') ?? '');
  const want = Buffer.from(`Bearer ${secret}`);
  const ok = sent.length === want.length && timingSafeEqual(sent, want);
  return ok ? null : NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

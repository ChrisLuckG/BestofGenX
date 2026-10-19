import { NextRequest, NextResponse } from 'next/server';
import { runArticlePush } from '@/lib/articlePush';
import { cronAuthError } from '@/lib/cronAuth';

// Every 5 minutes, called by .github/workflows/cron.yml (Vercel Hobby has no sub-daily crons, so it
// is NOT in vercel.json): push "new article" for what went live since the last run.
// See lib/articlePush.ts for the rules (one push per run, at most once per article).
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const denied = cronAuthError(request);
  if (denied) return denied;
  try {
    const result = await runArticlePush();
    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Article push failed';
    console.error('[ArticlePush] failed:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

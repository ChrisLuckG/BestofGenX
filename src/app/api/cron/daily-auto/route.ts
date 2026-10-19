import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import { tickDailyAuto } from '@/lib/dailyAuto';
import { cronAuthError } from '@/lib/cronAuth';
import { retryPendingTvVideos, expireToday } from '@/lib/personTvVideo';
import { runArticlePush } from '@/lib/articlePush';
import { fillPendingArticleVideos } from '@/lib/articleVideos';

// The tick, called every 5 minutes by .github/workflows/cron.yml (Vercel Hobby has no sub-daily
// crons, so it is NOT in vercel.json). It is idempotent: a slot is claimed once per day, so a
// tick that finds nothing due costs only a few database reads. Publishes the articles that are
// ready and due, then generates the ones whose lead time has begun. See lib/dailyAutoSchedule.ts
// for the rules and lib/dailyAuto.ts for what each slot kind does.
//
// A generation can include a 2-minute cover image plus a rankroll, hence the 5 minutes.
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const denied = cronAuthError(request);
  if (denied) return denied;
  try {
    await dbConnect();
    const result = await tickDailyAuto(new URL(request.url).origin);
    // Article sections written while the YouTube quota was used up get their videos now (lib/articleVideos.ts)
    const embeds = await fillPendingArticleVideos().catch(e => ({ error: e instanceof Error ? e.message : 'failed' }));
    // GenX TV: person articles whose video search hit the used-up YouTube quota get it now (lib/personTvVideo.ts)
    const tv = await retryPendingTvVideos().catch(e => ({ error: e instanceof Error ? e.message : 'failed' }));
    // ...and yesterday's leave "Todays Bogxers" for their own category
    await expireToday().catch(e => console.error('[GenX TV] expireToday failed', e));
    // The new-article push right here, after publishing - not only in the separate article-push call. GitHub starts
    // both in parallel, so that call ran BEFORE the 08:00 article was published (19.10.2026) and the next one came
    // much later. runArticlePush claims each article once (pushSentAt), so the two never send twice.
    const push = await runArticlePush().catch(e => ({ error: e instanceof Error ? e.message : 'failed' }));
    return NextResponse.json({ success: true, ...result, embeds, tv, push });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Daily Auto tick failed';
    console.error('[DailyAuto] tick failed:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

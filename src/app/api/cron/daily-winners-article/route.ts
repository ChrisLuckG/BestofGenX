import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';
import Article from '@/models/Article';
import GameResult from '@/models/GameResult';
import { berlinDateAt } from '@/lib/berlinTime';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// This job waits on /api/generate-image, which needs ~2 minutes at quality
// "high", plus the article-writing completion. Without this it hits the
// platform's default serverless timeout and no article gets created.
export const maxDuration = 300;

// Generate cover image via /api/generate-image
async function generateCoverImage(winnerName: string, dateNice: string, baseUrl: string): Promise<string | null> {
  try {
    const prompt = `Championship podium with golden trophy, winner's stage. Background color #F5F0E8 warm cream beige. Soft orange #E36B11 accents. Minimalist flat illustration style, subtle confetti. Warm cozy retro 80s 90s nostalgia aesthetic. Simple clean composition. NO people, NO faces, NO text, NO neon, NO dark colors.`;
    const response = await fetch(`${baseUrl}/api/generate-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, style: 'article', aspectRatio: 'landscape' }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.success && data.imageUrl ? data.imageUrl : null;
  } catch (err) {
    console.error('Cover image generation failed:', err);
    return null;
  }
}

// Convert flag emoji to ISO country code for flagcdn.com
function flagEmojiToCode(flag?: string): string | null {
  if (!flag) return null;
  if (flag.length === 2 && flag.charCodeAt(0) < 127) return flag.toLowerCase();
  const cps = Array.from(flag).map((c) => c.codePointAt(0) ?? 0);
  if (cps.length >= 2 && cps[0] >= 0x1f1e6 && cps[0] <= 0x1f1ff) {
    const a = String.fromCharCode(cps[0] - 0x1f1e6 + 65);
    const b = String.fromCharCode(cps[1] - 0x1f1e6 + 65);
    return (a + b).toLowerCase();
  }
  return null;
}

// Helper to get Berlin date string
function getBerlinDateString(date: Date = new Date()): string {
  return date.toLocaleString('en-CA', { 
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit', 
    day: '2-digit'
  }).split(',')[0];
}

// Helper to format date nicely
function formatDateNice(dateString: string): string {
  const date = new Date(dateString + 'T12:00:00Z');
  return date.toLocaleDateString('en-US', { 
    weekday: 'long',
    month: 'long', 
    day: 'numeric',
    year: 'numeric'
  });
}

// This endpoint is called by Vercel Cron at 9:01 Berlin time (after snapshot)
export async function GET(request: Request) {
  const startTime = Date.now();
  
  try {
    console.log('[CRON] Daily winners article triggered at', new Date().toISOString());
    
    await dbConnect();
    
    // Get yesterday's date (the day that just ended)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayString = getBerlinDateString(yesterday);
    
    // Check if article already exists for this date (skip with ?force=true)
    const url = new URL(request.url);
    const force = url.searchParams.get('force') === 'true';
    
    if (!force) {
      const existingArticle = await Article.findOne({ 
        tags: { $in: [`daily-winners-${yesterdayString}`] }
      });
      
      if (existingArticle) {
        return NextResponse.json({ 
          success: true, 
          message: 'Article already exists for this date',
          articleId: existingArticle._id
        });
      }
    }
    
    // Aggregate the just-ended ranking day from GameResult (single source of truth),
    // aligned to the 10:00 Berlin cutoff. The crons run during the 9-10 break, so the
    // window [yesterday 10:00 Berlin, today 10:00 Berlin) is effectively complete.
    const dayStart = berlinDateAt(-1, 10); // yesterday 10:00 Berlin
    const dayEnd = berlinDateAt(0, 10);    // today 10:00 Berlin
    
    const aggregated = await GameResult.aggregate([
      { $match: { playedAt: { $gte: dayStart, $lt: dayEnd } } },
      {
        $group: {
          _id: '$userId',
          username: { $first: '$username' },
          dailyPoints: { $sum: '$pointsChange' },
        },
      },
    ]);
    
    // Resolve user profile info, excluding deleted users
    const userIds = aggregated.map(r => r._id);
    const users = await User.find({ _id: { $in: userIds }, isDeleted: { $ne: true } })
      .select('username avatar country countryFlag bogxCoins')
      .lean();
    const userMap = new Map(users.map(u => [u._id.toString(), u as any]));
    
    const dailyRankings = aggregated
      .filter(r => userMap.has(r._id?.toString() || ''))
      .map(r => {
        const user = userMap.get(r._id?.toString() || '');
        return {
          oderId: r._id?.toString() || '',
          username: r.username || user.username,
          avatar: user.avatar || '',
          country: user.country || 'World',
          countryFlag: user.countryFlag || '🌍',
          dailyPoints: Math.round((r.dailyPoints || 0) * 100) / 100,
          totalPoints: user.bogxCoins || 0,
        };
      });
    
    // Sort by daily points and get top 3
    dailyRankings.sort((a, b) => b.dailyPoints - a.dailyPoints);
    const top3 = dailyRankings.filter(u => u.dailyPoints > 0).slice(0, 3);
    
    if (top3.length === 0) {
      console.log('[CRON] No winners for', yesterdayString);
      return NextResponse.json({ 
        success: true, 
        message: 'No winners to report (no games played)',
        date: yesterdayString
      });
    }
    
    // Generate article content with player cards + AI intro
    const dateNice = formatDateNice(yesterdayString);

    // Generate AI content: intro + personalized blurb per player
    const playersDesc = top3.map((w, i) => 
      `${i + 1}. ${w.username} (${w.country}) - ${w.dailyPoints.toFixed(2)} BOGX`
    ).join('\n');

    const aiPrompt = `You are writing for BestOfGenX, a GenX nostalgia community app. Write a short, punchy daily champions recap for ${dateNice}.

Players:
${playersDesc}

Return JSON with this structure:
{
  "intro": "2-3 sentence hype intro (no player names, just set the scene)",
  "players": [
    { "blurb": "1-2 fun sentences about this player's performance, mention their score and country" },
    ...one per player above...
  ],
  "outro": "1 short sentence teasing tomorrow's battle"
}

Keep it fun, GenX-flavored, energetic. Each player blurb should feel personal and different.`;

    // Position-specific fallback blurbs (more varied than generic)
    const fallbackBlurbs = [
      (w: typeof top3[0]) => `${w.username} dominated the leaderboard from ${w.country}, crushing it with ${w.dailyPoints.toFixed(2)} BOGX! An absolute masterclass.`,
      (w: typeof top3[0]) => `${w.username} from ${w.country} came in hot with ${w.dailyPoints.toFixed(2)} BOGX. So close to the crown!`,
      (w: typeof top3[0]) => `${w.username} representing ${w.country} secured the bronze with ${w.dailyPoints.toFixed(2)} BOGX. Solid performance!`,
    ];

    let aiContent: { intro: string; players: { blurb: string }[]; outro: string } = {
      intro: `Another fierce day of trivia battles is in the books! The competition was relentless and only the sharpest minds claimed the crown.`,
      players: top3.map((w, i) => ({ blurb: fallbackBlurbs[i]?.(w) || `${w.username} from ${w.country} earned ${w.dailyPoints.toFixed(2)} BOGX.` })),
      outro: `Think you can do better? The arena opens again tomorrow at 10:00 AM!`
    };
    
    try {
      console.log('[CRON] Generating AI content for daily winners...');
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: aiPrompt }],
        max_tokens: 500,
        temperature: 0.8,
        response_format: { type: 'json_object' },
      });
      const rawContent = completion.choices[0]?.message?.content || '{}';
      console.log('[CRON] AI response:', rawContent.substring(0, 200));
      const parsed = JSON.parse(rawContent);
      
      // Validate the response has all required fields
      if (parsed.intro && Array.isArray(parsed.players) && parsed.players.length >= top3.length) {
        aiContent = parsed;
        console.log('[CRON] AI content accepted');
      } else {
        console.log('[CRON] AI response incomplete, using fallbacks. Got:', {
          hasIntro: !!parsed.intro,
          playersCount: parsed.players?.length || 0,
          needed: top3.length
        });
      }
    } catch (aiError) {
      console.error('[CRON] AI generation failed, using fallback:', aiError);
    }
    
    // Build article using the same block system as the editor
    // Avatar uses background-image (not <img>) to avoid ArticlePage auto-expanding to full-width
    const rankColors  = ['#C9913A', '#8A9BB0', '#A0673A'];
    const rankBg      = ['rgba(201,145,58,0.08)', 'rgba(138,155,176,0.08)', 'rgba(160,103,58,0.08)'];
    const rankNums    = ['01', '02', '03'];
    const rankLabels  = ['CHAMPION', 'RUNNER-UP', 'THIRD'];

    const playerSectionsHtml = top3.map((player, index) => {
      const blurb = aiContent.players[index]?.blurb || '';
      const avatarSrc = player.avatar || '/images/default-avatar.png';
      const flagCode = flagEmojiToCode(player.countryFlag);
      const flagHtml = flagCode
        ? `<span style="display:inline-block;width:18px;height:13px;border-radius:2px;vertical-align:middle;margin-right:5px;background-image:url('https://flagcdn.com/24x18/${flagCode}.png');background-size:cover;background-position:center;flex-shrink:0;"></span>`
        : '';
      const color = rankColors[index];
      const bg = rankBg[index];
      return `<div style="background:${bg};border:1px solid ${color}30;border-left:4px solid ${color};border-radius:8px;margin:16px 0;overflow:hidden;padding:12px 14px;">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:38px;flex-shrink:0;">
      <span style="font-family:monospace;font-size:20px;font-weight:900;color:${color};line-height:1;">${rankNums[index]}</span>
      <span style="font-size:8px;font-weight:700;letter-spacing:0.08em;color:${color}99;text-transform:uppercase;white-space:nowrap;">${rankLabels[index]}</span>
    </div>
    <div style="width:40px;height:40px;min-width:40px;border-radius:50%;background-image:url('${avatarSrc}');background-size:cover;background-position:center;border:2px solid ${color};flex-shrink:0;"></div>
    <div style="flex:1;min-width:0;overflow:hidden;">
      <div style="font-size:13px;font-weight:800;letter-spacing:0.04em;color:#1a1a1a;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${player.username}</div>
      <div style="display:flex;align-items:center;flex-wrap:wrap;gap:4px;font-size:11px;color:#888;">${flagHtml}${player.country} &nbsp;·&nbsp; <strong style="color:${color};font-size:12px;">${player.dailyPoints.toFixed(2)} BOGX</strong></div>
    </div>
  </div>
  <p style="margin:0;font-size:13px;color:#555;line-height:1.55;">${blurb}</p>
</div>`;
    }).join('\n');

    // Use the exact Arcade CTA block from the editor block system
    const arcadeCtaBlock = `<div class="cta-block arcade-cta-banner" data-cta-type="arcade" style="display:flex;flex-direction:column;gap:12px;padding:16px;background:linear-gradient(to right,rgba(139,92,246,0.15),rgba(139,92,246,0.05));border-radius:16px;border:1px solid rgba(139,92,246,0.2);margin:24px 0;cursor:pointer;"><div style="display:flex;align-items:center;gap:12px;"><div class="cta-icon" style="width:44px;height:44px;min-width:44px;background:#8B5CF6;border-radius:50%;display:flex;align-items:center;justify-content:center;" data-emoji="🎮"><svg width="22" height="22" fill="white" viewBox="0 0 24 24"><path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-10 7H8v3H6v-3H3v-2h3V8h2v3h3v2zm4.5 2c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4-3c-.83 0-1.5-.67-1.5-1.5S18.67 9 19.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg></div><div><div style="font-weight:700;color:#1a1a1a;font-size:14px;line-height:1.3;">Play Trivia</div><div style="font-size:12px;color:#666;line-height:1.4;">Test your 80s/90s knowledge and win BOGX!</div></div></div><span style="display:block;text-align:center;padding:10px 18px;background:#8B5CF6;color:white;border-radius:10px;font-weight:700;font-size:13px;">Go to Trivia →</span></div>`;

    const articleBody = `<p>${aiContent.intro}</p>
${playerSectionsHtml}
<p style="font-style:italic;color:#9CA3AF;font-size:13px;">${aiContent.outro}</p>
${arcadeCtaBlock}`;
    
    // Create the article - Title: "Daily Champions: Tuesday, June 23"
    const niceDateFull = formatDateNice(yesterdayString); // "Tuesday, June 23, 2026"
    const niceDateNoYear = niceDateFull.split(',').slice(0, 2).join(',').trim(); // "Tuesday, June 23"
    const title = `Daily Champions: ${niceDateNoYear}`;
    const subtitle = `${top3[0].username} takes the crown with ${top3[0].dailyPoints.toFixed(2)} BOGX!`;
    
    // Generate cover image
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL 
      ? process.env.NEXT_PUBLIC_BASE_URL
      : process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}` 
        : 'http://localhost:3000';
    const coverImage = await generateCoverImage(top3[0].username, dateNice, baseUrl) || '/images/winners-default.jpg';

    const article = await Article.create({
      title,
      subtitle,
      content: articleBody,
      category: 'gaming',
      mainCategory: 'articles',
      coverImage,
      thumbnailUrl: coverImage,
      authorName: 'BOGX Bot',
      tags: [`daily-winners-${yesterdayString}`, 'daily-winners', 'rankings', 'champions'],
      status: 'published',
      publishedAt: new Date(),
      featured: false,
      views: 0,
    });
    
    const duration = Date.now() - startTime;
    console.log(`[CRON] Daily winners article created in ${duration}ms:`, article._id);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Daily winners article created',
      articleId: article._id,
      title,
      winners: top3.map(w => w.username),
      duration: `${duration}ms`
    });
  } catch (error) {
    console.error('[CRON] Daily winners article error:', error);
    return NextResponse.json({ 
      error: 'Failed to create article', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

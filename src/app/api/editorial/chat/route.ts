import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';
import ReporterProfile from '@/models/ReporterProfile';
import EditorialConversation from '@/models/EditorialConversation';
import Article from '@/models/Article';
import { generateReporterSystemPrompt } from '@/lib/generateReporterPrompt';

function loadBogxSystemPrompt(): string {
  try {
    const promptPath = path.join(process.cwd(), 'src', 'prompts', 'system-prompt.txt');
    return fs.readFileSync(promptPath, 'utf-8');
  } catch {
    return '';
  }
}

async function fetchLiveContext(month: number, day: number): Promise<string> {
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/feed/onthisday/all/${month}/${day}`,
      { headers: { 'User-Agent': 'BOGX-Editorial/1.0' }, signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return '';
    const data = await res.json();

    const lines: string[] = [];

    // Notable births today (filter for GenX era relevance: born 1940-1985)
    const births = (data.births || [])
      .filter((b: any) => b.year >= 1940 && b.year <= 1985)
      .slice(0, 6)
      .map((b: any) => `  - ${b.text?.split('.')[0]} (born ${b.year})`);
    if (births.length) lines.push(`BIRTHDAYS TODAY (GenX relevant):\n${births.join('\n')}`);

    // Deaths today
    const deaths = (data.deaths || [])
      .filter((d: any) => d.year >= 1960)
      .slice(0, 4)
      .map((d: any) => `  - ${d.text?.split('.')[0]} (${d.year})`);
    if (deaths.length) lines.push(`DEATHS ON THIS DAY:\n${deaths.join('\n')}`);

    // Notable events
    const events = (data.events || [])
      .filter((e: any) => e.year >= 1960 && e.year <= 2010)
      .slice(0, 5)
      .map((e: any) => `  - ${e.year}: ${e.text?.split('.')[0]}`);
    if (events.length) lines.push(`NOTABLE EVENTS ON THIS DAY:\n${events.join('\n')}`);

    return lines.length ? `\n================================================================================\nLIVE CONTEXT — TODAY IN HISTORY (use this for article ideas and accurate reporting)\n================================================================================\n${lines.join('\n\n')}\n` : '';
  } catch {
    return ''; // Fail silently — don't block chat
  }
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// These are APPROVAL keywords only — reporter must have proposed first
// Broad topic words ("write", "article") no longer trigger creation
const APPROVAL_KEYWORDS = [
  'go ahead', 'go for it', 'create it', 'create the article', 'create the draft',
  'draft it', 'draft the article', 'write it now', 'write it', 'write the article',
  'approved', 'approval', 'yes create', 'yes draft', 'yes write',
  'mach es', 'erstell es', 'schreib es', 'mach das', 'ja mach',
  'do it', 'proceed', 'make it', 'publish it', 'save it',
];
// Short standalone approval words (whole message must be just this)
const STANDALONE_APPROVALS = ['go', 'yes', 'ja', 'ok', 'okay', 'yep', 'sure', 'deal', 'perfect', 'great'];

function isArticleApproval(message: string): boolean {
  const lower = message.trim().toLowerCase();
  // Exact standalone approval
  if (STANDALONE_APPROVALS.includes(lower)) return true;
  // Contains explicit approval phrase
  return APPROVAL_KEYWORDS.some(kw => lower.includes(kw));
}

// CTA HTML blocks (mirrors BlockEditor.tsx constants)
const CTA_HTML: Record<string, string> = {
  radio: `<div class="cta-block radio-cta-banner" data-cta-type="radio" style="display:flex;flex-direction:column;gap:12px;padding:16px;background:linear-gradient(to right,rgba(212,135,58,0.15),rgba(212,135,58,0.05));border-radius:16px;border:1px solid rgba(212,135,58,0.2);margin:24px 0;cursor:pointer;"><div style="display:flex;align-items:center;gap:12px;"><div class="cta-icon" style="width:44px;height:44px;min-width:44px;background:#D4873A;border-radius:50%;display:flex;align-items:center;justify-content:center;" data-emoji="🎧"><svg width="22" height="22" fill="white" viewBox="0 0 24 24"><path d="M12 1c-4.97 0-9 4.03-9 9v7c0 1.66 1.34 3 3 3h3v-8H5v-2c0-3.87 3.13-7 7-7s7 3.13 7 7v2h-4v8h3c1.66 0 3-1.34 3-3v-7c0-4.97-4.03-9-9-9z"/></svg></div><div><div style="font-weight:700;color:#1a1a1a;font-size:14px;line-height:1.3;">Listen on GenX Radio</div><div style="font-size:12px;color:#666;line-height:1.4;">Discover more timeless tracks on our radio.</div></div></div><span style="display:block;text-align:center;padding:10px 18px;background:#D4873A;color:white;border-radius:10px;font-weight:700;font-size:13px;">Go to Radio →</span></div>`,
  arcade: `<div class="cta-block arcade-cta-banner" data-cta-type="arcade" style="display:flex;flex-direction:column;gap:12px;padding:16px;background:linear-gradient(to right,rgba(139,92,246,0.15),rgba(139,92,246,0.05));border-radius:16px;border:1px solid rgba(139,92,246,0.2);margin:24px 0;cursor:pointer;"><div style="display:flex;align-items:center;gap:12px;"><div class="cta-icon" style="width:44px;height:44px;min-width:44px;background:#8B5CF6;border-radius:50%;display:flex;align-items:center;justify-content:center;" data-emoji="🎮"><svg width="22" height="22" fill="white" viewBox="0 0 24 24"><path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-10 7H8v3H6v-3H3v-2h3V8h2v3h3v2zm4.5 2c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4-3c-.83 0-1.5-.67-1.5-1.5S18.67 9 19.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg></div><div><div style="font-weight:700;color:#1a1a1a;font-size:14px;line-height:1.3;">Play Trivia</div><div style="font-size:12px;color:#666;line-height:1.4;">Test your 80s/90s knowledge and win BOGX!</div></div></div><span style="display:block;text-align:center;padding:10px 18px;background:#8B5CF6;color:white;border-radius:10px;font-weight:700;font-size:13px;">Go to Trivia →</span></div>`,
  shop: `<div class="cta-block shop-cta-banner" data-cta-type="shop" style="display:flex;flex-direction:column;gap:12px;padding:16px;background:linear-gradient(to right,rgba(236,72,153,0.15),rgba(236,72,153,0.05));border-radius:16px;border:1px solid rgba(236,72,153,0.2);margin:24px 0;cursor:pointer;"><div style="display:flex;align-items:center;gap:12px;"><div class="cta-icon" style="width:44px;height:44px;min-width:44px;background:#EC4899;border-radius:50%;display:flex;align-items:center;justify-content:center;" data-emoji="🛍️"><svg width="22" height="22" fill="white" viewBox="0 0 24 24"><path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/></svg></div><div><div style="font-weight:700;color:#1a1a1a;font-size:14px;line-height:1.3;">Visit the Shop</div><div style="font-size:12px;color:#666;line-height:1.4;">Get exclusive GenX merch and collectibles.</div></div></div><span style="display:block;text-align:center;padding:10px 18px;background:#EC4899;color:white;border-radius:10px;font-weight:700;font-size:13px;">Go to Shop →</span></div>`,
  articles: `<div class="cta-block articles-cta-banner" data-cta-type="articles" style="display:flex;flex-direction:column;gap:12px;padding:16px;background:linear-gradient(to right,rgba(34,197,94,0.15),rgba(34,197,94,0.05));border-radius:16px;border:1px solid rgba(34,197,94,0.2);margin:24px 0;cursor:pointer;"><div style="display:flex;align-items:center;gap:12px;"><div class="cta-icon" style="width:44px;height:44px;min-width:44px;background:#22C55E;border-radius:50%;display:flex;align-items:center;justify-content:center;" data-emoji="📰"><svg width="22" height="22" fill="white" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg></div><div><div style="font-weight:700;color:#1a1a1a;font-size:14px;line-height:1.3;">More Articles</div><div style="font-size:12px;color:#666;line-height:1.4;">Discover more stories from the GenX era.</div></div></div><span style="display:block;text-align:center;padding:10px 18px;background:#22C55E;color:white;border-radius:10px;font-weight:700;font-size:13px;">Browse Articles →</span></div>`,
  tv: `<div class="cta-block tv-cta-banner" data-cta-type="tv" style="display:flex;flex-direction:column;gap:12px;padding:16px;background:linear-gradient(to right,rgba(59,130,246,0.15),rgba(59,130,246,0.05));border-radius:16px;border:1px solid rgba(59,130,246,0.2);margin:24px 0;cursor:pointer;"><div style="display:flex;align-items:center;gap:12px;"><div class="cta-icon" style="width:44px;height:44px;min-width:44px;background:#3B82F6;border-radius:50%;display:flex;align-items:center;justify-content:center;" data-emoji="📺"><svg width="22" height="22" fill="white" viewBox="0 0 24 24"><path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z"/></svg></div><div><div style="font-weight:700;color:#1a1a1a;font-size:14px;line-height:1.3;">Watch GenX TV</div><div style="font-size:12px;color:#666;line-height:1.4;">Classic videos and nostalgic content.</div></div></div><span style="display:block;text-align:center;padding:10px 18px;background:#3B82F6;color:white;border-radius:10px;font-weight:700;font-size:13px;">Go to TV →</span></div>`,
  rankroll: `<div class="cta-block rankroll-cta-banner" data-cta-type="rankroll" data-rankroll-id="" style="display:flex;flex-direction:column;gap:12px;padding:16px;background:linear-gradient(to right,rgba(212,135,58,0.15),rgba(212,135,58,0.05));border-radius:16px;border:1px solid rgba(212,135,58,0.2);margin:24px 0;cursor:pointer;"><div style="display:flex;align-items:center;gap:12px;"><div class="cta-icon" style="width:44px;height:44px;min-width:44px;background:#D4873A;border-radius:50%;display:flex;align-items:center;justify-content:center;" data-emoji="🗳️"><svg width="22" height="22" fill="white" viewBox="0 0 24 24"><path d="M18 13h-.68l-2 2h1.91L19 17H5l1.78-2h2.05l-2-2H6l-3 3v4c0 1.1.89 2 1.99 2H19c1.1 0 2-.89 2-2v-4l-3-3zm-1-5.05l-4.95 4.95-3.54-3.54 4.95-4.95 3.54 3.54zm-4.24-5.66L6.39 8.66a.996.996 0 000 1.41l4.95 4.95c.39.39 1.02.39 1.41 0l6.36-6.36a.996.996 0 000-1.41l-4.95-4.95a.996.996 0 00-1.41 0z"/></svg></div><div><div style="font-weight:700;color:#1a1a1a;font-size:14px;line-height:1.3;">Vote Now!</div><div style="font-size:12px;color:#666;line-height:1.4;">Cast your vote and rank your favorites.</div></div></div><span style="display:block;text-align:center;padding:10px 18px;background:#D4873A;color:white;border-radius:10px;font-weight:700;font-size:13px;">Go to Rankroll →</span></div>`,
};

function buildYoutubeCta(searchTerm: string): string {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchTerm)}`;
  return `<div class="cta-block" data-cta-type="youtube" style="display:flex;flex-direction:column;gap:12px;padding:16px;background:linear-gradient(to right,rgba(255,0,0,0.12),rgba(255,0,0,0.03));border-radius:16px;border:1px solid rgba(255,0,0,0.2);margin:24px 0;cursor:pointer;" onclick="window.open('${url}','_blank')"><div style="display:flex;align-items:center;gap:12px;"><div style="width:44px;height:44px;min-width:44px;background:#FF0000;border-radius:50%;display:flex;align-items:center;justify-content:center;"><svg width="22" height="22" fill="white" viewBox="0 0 24 24"><path d="M21.58 7.19c-.23-.86-.91-1.54-1.77-1.77C18.25 5 12 5 12 5s-6.25 0-7.81.42c-.86.23-1.54.91-1.77 1.77C2 8.75 2 12 2 12s0 3.25.42 4.81c.23.86.91 1.54 1.77 1.77C5.75 19 12 19 12 19s6.25 0 7.81-.42c.86-.23 1.54-.91 1.77-1.77C22 15.25 22 12 22 12s0-3.25-.42-4.81zM10 15V9l5.2 3-5.2 3z"/></svg></div><div><div style="font-weight:700;color:#1a1a1a;font-size:14px;line-height:1.3;">Watch on YouTube</div><div style="font-size:12px;color:#666;line-height:1.4;">${searchTerm}</div></div></div><span style="display:block;text-align:center;padding:10px 18px;background:#FF0000;color:white;border-radius:10px;font-weight:700;font-size:13px;">Watch Now →</span></div>`;
}

function injectCtasIntoContent(content: string, ctas: string[], youtubeSearchTerm?: string): string {
  const ctaBlocks: string[] = [];
  // YouTube CTA first if present
  if (youtubeSearchTerm) ctaBlocks.push(buildYoutubeCta(youtubeSearchTerm));
  // Platform CTAs
  const validCtas = ['radio', 'arcade', 'shop', 'articles', 'tv', 'rankroll'];
  (ctas || []).forEach(cta => {
    if (validCtas.includes(cta) && CTA_HTML[cta]) ctaBlocks.push(CTA_HTML[cta]);
  });
  if (!ctaBlocks.length) return content;
  return content + '\n' + ctaBlocks.join('\n');
}

async function searchWikimediaImage(term: string): Promise<string | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/search-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: term }),
    });
    const data = await res.json();
    if (data.success && data.allImages?.length > 0) {
      return data.allImages[0].url || data.allImages[0].thumbUrl || null;
    }
  } catch { /* silently fail */ }
  return null;
}

async function searchTenorGif(term: string): Promise<string | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/tenor-search?q=${encodeURIComponent(term)}`);
    const data = await res.json();
    if (data.success && data.results?.length > 0) {
      return data.results[0] || null;
    }
  } catch { /* silently fail */ }
  return null;
}

// Extract potential memories from reporter response (simple heuristic)
function extractMemories(userMsg: string, response: string): string[] {
  const memories: string[] = [];
  const lower = userMsg.toLowerCase();
  if (lower.includes('remember') || lower.includes('merke') || lower.includes('vergiss nicht') || lower.includes("don't forget")) {
    memories.push(`User said: "${userMsg.slice(0, 200)}"`);
  }
  return memories;
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    const body = await request.json();
    const { reporterUserId, message, conversationId } = body;

    if (!reporterUserId || !message) {
      return NextResponse.json({ success: false, error: 'reporterUserId and message required' }, { status: 400 });
    }

    // Load reporter
    const profile = await ReporterProfile.findOne({ userId: reporterUserId });
    if (!profile) {
      return NextResponse.json({ success: false, error: 'Reporter not found' }, { status: 404 });
    }
    const user = await User.findById(reporterUserId).select('displayName username avatar').lean();
    const reporterName = (user as any)?.displayName || (user as any)?.username || 'Reporter';

    // Load or create conversation
    let conversation = conversationId
      ? await EditorialConversation.findById(conversationId)
      : null;

    if (!conversation) {
      conversation = await EditorialConversation.create({
        reporterId: reporterUserId,
        type: 'direct',
        participantIds: [reporterUserId],
        title: message.slice(0, 60),
        messages: [],
      });
    }

    // Build OpenAI messages from history (last 20 messages for context)
    const historyMessages = conversation.messages.slice(-20).map((m: any) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content,
    }));

    // Rebuild system prompt: BOGX knowledge (system-prompt.txt) + reporter persona
    const bogxKnowledge = loadBogxSystemPrompt();
    const reporterPersona = generateReporterSystemPrompt({
      name: reporterName,
      role: profile.role,
      nationality: profile.nationality,
      responsibilities: profile.responsibilities,
      writingStyle: profile.writingStyle,
      politicalTendency: profile.politicalTendency,
      personality: profile.personality,
      memories: profile.memories,
    });
    // Inject real date + live Wikipedia context
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const liveContext = await fetchLiveContext(now.getMonth() + 1, now.getDate());

    // Combine: reporter persona first (their identity), then full BOGX knowledge
    const systemPrompt = `TODAY'S DATE: ${dateStr}
You know today's exact date. Never guess or make up the date.
${liveContext}
${reporterPersona}

================================================================================
FULL BOGX PLATFORM KNOWLEDGE (study this — it is your employer's complete guide)
================================================================================
${bogxKnowledge}`;

    const articleMode = isArticleApproval(message);

    const userMessageContent = articleMode
      ? `${message}\n\nEDITOR APPROVED. Output ONLY valid JSON, nothing else:\n{"title":"...","subtitle":"...","content":"<p>...</p><h2>...</h2><p>...</p>","tags":["..."],"category":"movies-tv|music|gaming|sports|tech|culture|news|lifestyle|genx-icons|rip","imageSearchTerm":"specific search term for Wikimedia cover image","ctas":["rankroll","tv","articles"],"youtubeSearchTerm":"specific iconic YouTube clip title for this topic"}`
      : message;

    const openaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...historyMessages,
      { role: 'user', content: userMessageContent },
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: openaiMessages,
      temperature: 0.85,
      max_tokens: 2000, // always allow full response — reporter may generate JSON even in non-article mode
    });

    const rawResponse = completion.choices[0]?.message?.content || '';

    // Save user message to conversation
    conversation.messages.push({
      role: 'user',
      content: message,
      timestamp: new Date(),
    });

    let finalResponse = rawResponse;
    let articleDraftId: string | null = null;
    let articleTitle: string | null = null;

    // Handle article generation — always try to parse JSON in case reporter generated it
    // (reporter's system prompt controls when it outputs JSON, not just the mode flag)
    const looksLikeJson = rawResponse.trim().startsWith('{') || rawResponse.includes('"title"') && rawResponse.includes('"content"');
    if (articleMode || looksLikeJson) {
      try {
        const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);

          // Find cover image: Tenor GIFs first (animated), Wikimedia as fallback
          let coverImage = '';
          const searchTerm = parsed.imageSearchTerm || parsed.title || message;

          coverImage = (await searchTenorGif(searchTerm)) || '';
          if (!coverImage) {
            coverImage = (await searchWikimediaImage(searchTerm)) || '';
          }

          // Save as Article draft
          const validCategories = ['history', 'movies-tv', 'music', 'gaming', 'sports', 'tech', 'culture', 'news', 'lifestyle', 'genx-icons', 'rip'];
          // Guard: reporter sometimes returns the full pipe-string instead of one value
          const rawCategory = (parsed.category || '').split('|')[0].trim().toLowerCase();
          const safeCategory = validCategories.includes(rawCategory) ? rawCategory : 'culture';

          // Inject CTAs into content
          const contentWithCtas = injectCtasIntoContent(
            parsed.content || '',
            parsed.ctas || [],
            parsed.youtubeSearchTerm || ''
          );

          const article = await Article.create({
            title: parsed.title || 'Untitled',
            subtitle: parsed.subtitle || '',
            content: contentWithCtas,
            coverImage,
            thumbnailUrl: coverImage,
            tags: parsed.tags || [],
            category: safeCategory,
            mainCategory: 'articles',
            contentType: 'article',
            author: reporterUserId,
            authorName: reporterName,
            authorAvatar: (user as any)?.avatar || '',
            status: 'draft',
            layout: 'standard',
            autoGenerated: true,
          });

          articleDraftId = article._id.toString();
          articleTitle = parsed.title || 'Untitled';
          profile.articleCount = (profile.articleCount || 0) + 1;

          const ctaCount = (parsed.ctas || []).length + (parsed.youtubeSearchTerm ? 1 : 0);
          const ctaSummary = ctaCount > 0 ? ` · ${ctaCount} CTA${ctaCount > 1 ? 's' : ''} added${parsed.youtubeSearchTerm ? ' (incl. YouTube)' : ''}` : '';
          finalResponse = `✅ **Draft saved:** "${articleTitle}"

Category: ${safeCategory}${coverImage ? ' · Cover image found' : ' · No cover image'}${ctaSummary}

It's in the Articles tab → Drafts. Review it, edit if needed, then publish. Want me to change anything?`
        }
      } catch {
        finalResponse = rawResponse;
      }
    }

    // Save reporter message to conversation
    conversation.messages.push({
      role: 'reporter',
      reporterId: reporterUserId,
      reporterName,
      content: finalResponse,
      articleDraftId: articleDraftId || undefined,
      timestamp: new Date(),
    } as any);

    // Extract and save new memories
    const newMemories = extractMemories(message, finalResponse);
    if (newMemories.length > 0) {
      profile.memories = [...(profile.memories || []), ...newMemories].slice(-50); // keep last 50
    }

    profile.lastActive = new Date();
    await Promise.all([conversation.save(), profile.save()]);

    return NextResponse.json({
      success: true,
      conversationId: conversation._id.toString(),
      response: finalResponse,
      articleDraftId,
      articleTitle,
      isArticle: !!articleDraftId,
      reporterName,
    });
  } catch (error) {
    console.error('Editorial chat error:', error);
    return NextResponse.json({ success: false, error: 'Chat failed' }, { status: 500 });
  }
}

// GET - load conversation history
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const reporterUserId = searchParams.get('reporterUserId');
    const conversationId = searchParams.get('conversationId');

    if (conversationId) {
      const conv = await EditorialConversation.findById(conversationId).lean();
      return NextResponse.json({ success: true, conversation: conv });
    }

    if (reporterUserId) {
      const conv = await EditorialConversation.findOne({ reporterId: reporterUserId })
        .sort({ updatedAt: -1 })
        .lean();
      return NextResponse.json({ success: true, conversation: conv || null });
    }

    return NextResponse.json({ success: false, error: 'reporterUserId or conversationId required' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import dbConnect from '@/lib/mongoose';
import Article from '@/models/Article';
import User from '@/models/User';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Spotify Playlist IDs - keep in sync with mobile/page.tsx radioStations
const PLAYLIST_IDS: Record<string, string> = {
  'Techno': '46ti4ZIw1QCHuhRox8wR4f',
  'HipHop': '46ti4ZIw1QCHuhRox8wR4f',
  'Mainstream Radio': '46ti4ZIw1QCHuhRox8wR4f',
  'Hot News': '46ti4ZIw1QCHuhRox8wR4f',
  'Indi': '46ti4ZIw1QCHuhRox8wR4f',
};

interface SongRequest {
  username: string;
  playlist: string;
  band: string;
  song: string;
  link?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { requests, createArticle } = await request.json() as { requests: SongRequest[], createArticle?: boolean };

    if (!requests || requests.length === 0) {
      return NextResponse.json({ success: false, error: 'No requests provided' }, { status: 400 });
    }

    // Load system prompt
    const promptPath = path.join(process.cwd(), 'src', 'prompts', 'system-prompt.txt');
    const systemPrompt = fs.readFileSync(promptPath, 'utf-8');

    // Build the song list for the prompt
    const songList = requests.map((r, i) => 
      `${i + 1}. Username: ${r.username}\n   Song: "${r.song}" by ${r.band}\n   Playlist: ${r.playlist}`
    ).join('\n\n');

    const currentMonth = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    // User prompt contains only DATA, instructions are in system-prompt.txt (AUFGABE 6)
    const userPrompt = `Generate monthly playlist article for ${currentMonth}.

Song contributions this month:

${songList}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.8,
      max_tokens: 2000,
    });

    const fullArticle = completion.choices[0]?.message?.content || '';
    
    // Parse title and content
    const lines = fullArticle.split('\n');
    const title = lines[0]?.replace(/^#\s*/, '').trim() || `Playlist Highlights - ${currentMonth}`;
    let content = lines.slice(2).join('\n').trim() || fullArticle;

    // Add call-to-action to open radio panel
    content += `\n\n<hr>\n\n<h2>Want to Add Your Own?</h2>\n<p>Head to our <a href="#" onclick="window.dispatchEvent(new CustomEvent('openRadio')); return false;" style="color:#D4873A;font-weight:bold;">Radio section</a> and suggest your favorite GenX tracks. Every accepted song earns you 50 points!</p>`;

    // Create article in database if requested
    let articleId: string | undefined;
    if (createArticle) {
      await dbConnect();
      
      // Find an admin user to be the author
      const adminUser = await User.findOne({ isAdmin: true }).lean();
      if (!adminUser) {
        return NextResponse.json({ success: true, article: fullArticle, error: 'No admin user found to set as author' });
      }

      const newArticle = await Article.create({
        title,
        subtitle: `Community Song Picks for ${currentMonth}`,
        content,
        mainCategory: 'articles',
        category: 'music',
        tags: ['playlist', 'community', 'music', currentMonth.toLowerCase().replace(' ', '-')],
        author: adminUser._id,
        authorName: adminUser.username || 'Best of GenX Team',
        status: 'draft',
        layout: 'standard',
        featured: false,
        trending: false,
      });
      articleId = newArticle._id.toString();
    }

    return NextResponse.json({ success: true, article: fullArticle, articleId });
  } catch (error: unknown) {
    console.error('generate-song-article error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

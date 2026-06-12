import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';
import Article from '@/models/Article';
import DailyRanking from '@/models/DailyRanking';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
    
    // Check if article already exists for this date
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
    
    // Get yesterday's snapshot to find the day before
    const dayBeforeYesterday = new Date(yesterday);
    dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 1);
    const dayBeforeString = getBerlinDateString(dayBeforeYesterday);
    
    // Get baseline snapshot (day before yesterday)
    const baselineSnapshot = await DailyRanking.findOne({ dateString: dayBeforeString });
    const baselineMap = new Map<string, number>();
    
    if (baselineSnapshot) {
      for (const entry of baselineSnapshot.rankings) {
        baselineMap.set(entry.userId?.toString() || '', entry.points || 0);
      }
    }
    
    // Get all users and calculate daily points
    const allUsers = await User.find({ isDeleted: { $ne: true } })
      .select('username avatar country countryFlag points wins')
      .lean();
    
    const dailyRankings = allUsers.map(user => {
      const oderId = user._id.toString();
      const baselinePoints = baselineMap.get(oderId) || 0;
      const dailyPoints = (user.points || 0) - baselinePoints;
      return {
        oderId,
        username: user.username,
        avatar: user.avatar || '',
        country: user.country || 'World',
        countryFlag: user.countryFlag || '🌍',
        dailyPoints,
        totalPoints: user.points || 0,
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
    
    // Generate article content with AI
    const dateNice = formatDateNice(yesterdayString);
    const winnersText = top3.map((w, i) => 
      `${i + 1}. ${w.username} (${w.country}) - ${w.dailyPoints.toFixed(2)} BOGX`
    ).join('\n');
    
    const aiPrompt = `Write a short, exciting news article (2-3 paragraphs) about the daily winners of the BOGX trivia game for ${dateNice}. 

Top 3 Winners:
${winnersText}

The article should:
- Congratulate the winners enthusiastically
- Mention each winner by name and their score
- Be written in a fun, engaging sports-news style
- Include a call to action to play tomorrow
- Be around 150-200 words

Do NOT include a title - just the article body.`;

    let articleBody = '';
    
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: aiPrompt }],
        max_tokens: 500,
        temperature: 0.8,
      });
      articleBody = completion.choices[0]?.message?.content || '';
    } catch (aiError) {
      console.error('[CRON] AI generation failed, using fallback:', aiError);
      // Fallback content
      articleBody = `Congratulations to our daily champions! 🏆\n\n${top3.map((w, i) => 
        `**${i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'} ${w.username}** from ${w.country} earned ${w.dailyPoints.toFixed(2)} BOGX!`
      ).join('\n\n')}\n\nThink you can beat them? Join the competition tomorrow at 10:00 AM!`;
    }
    
    // Create the article
    const title = `Daily Champions: ${formatDateNice(yesterdayString).split(',')[0]}`;
    const subtitle = `${top3[0].username} takes the crown with ${top3[0].dailyPoints.toFixed(2)} BOGX!`;
    
    const article = await Article.create({
      title,
      subtitle,
      content: articleBody,
      category: 'Gaming',
      subcategory: 'Daily Rankings',
      author: 'BOGX Bot',
      authorId: null,
      image: '/images/winners-default.jpg', // Default winners image
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

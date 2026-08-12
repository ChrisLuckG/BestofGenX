import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';
import Article from '@/models/Article';
import GameResult from '@/models/GameResult';
import Reaction from '@/models/Reaction';

/**
 * Bot Daily Activity - Simulates realistic user behavior
 * Called by cron job or manually to make bots behave like real users
 * 
 * Activities:
 * - Read articles (earn BOGX)
 * - Watch videos (earn BOGX)
 * - React to articles with emojis (earn BOGX)
 * - Play trivia games (earn/lose BOGX)
 */

const EMOJI_OPTIONS = ['❤️', '😂', '😮', '😢', '😡', '👏'];

export async function GET(request: Request) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    const targetDate = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const intensity = searchParams.get('intensity') || 'normal'; // low, normal, high
    
    // Find all active bots
    const bots = await User.find({ 
      isBot: true,
      botActive: { $ne: false }
    });
    
    if (bots.length === 0) {
      return NextResponse.json({ success: true, message: 'No active bots found' });
    }
    
    // Get published articles for bots to interact with
    const articles = await Article.find({ status: 'published' })
      .select('_id title contentType')
      .limit(100)
      .lean();
    
    if (articles.length === 0) {
      return NextResponse.json({ success: true, message: 'No articles found for bots to interact with' });
    }
    
    // Activity multipliers based on intensity
    const multiplier = intensity === 'low' ? 0.5 : intensity === 'high' ? 2 : 1;
    
    const stats = {
      botsActive: 0,
      articlesRead: 0,
      videosWatched: 0,
      reactionsAdded: 0,
      gamesPlayed: 0,
      totalBogxEarned: 0,
    };
    
    for (const bot of bots) {
      // 70-90% chance a bot is active today (realistic)
      const activityChance = 0.7 + Math.random() * 0.2;
      if (Math.random() > activityChance) continue;
      
      stats.botsActive++;
      let botBogx = bot.bogxCoins || 0;
      
      // 1. READ ARTICLES (1-5 per day, earn 0.10 BOGX each)
      const articlesToRead = Math.floor((Math.random() * 5 + 1) * multiplier);
      const shuffledArticles = [...articles].sort(() => Math.random() - 0.5);
      
      for (let i = 0; i < Math.min(articlesToRead, shuffledArticles.length); i++) {
        const article = shuffledArticles[i];
        
        // Check if bot already read this article
        const alreadyRead = bot.readArticles?.includes(article._id.toString());
        if (alreadyRead) continue;
        
        // Award BOGX for reading
        const bogxEarned = 0.10;
        botBogx += bogxEarned;
        stats.articlesRead++;
        stats.totalBogxEarned += bogxEarned;
        
        // Record the read
        await User.findByIdAndUpdate(bot._id, {
          $addToSet: { readArticles: article._id.toString() },
          $inc: { bogxCoins: bogxEarned }
        });
        
        // Create GameResult for tracking
        await GameResult.create({
          userId: bot._id.toString(),
          username: bot.username,
          cardId: `article-${article._id}`,
          question: `Read: ${article.title}`,
          userAnswer: 'read',
          correctAnswer: 'read',
          gameDate: targetDate,
          isCorrect: true,
          pointsChange: bogxEarned,
          pointsBefore: botBogx - bogxEarned,
          pointsAfter: botBogx,
        });
      }
      
      // 2. WATCH VIDEOS (0-2 per day, earn 0.15 BOGX each)
      // TV content type contains videos
      const videoArticles = articles.filter(a => a.contentType === 'tv');
      const videosToWatch = Math.floor(Math.random() * 3 * multiplier);
      
      for (let i = 0; i < Math.min(videosToWatch, videoArticles.length); i++) {
        const video = videoArticles[i];
        
        // Check if bot already watched
        const alreadyWatched = bot.watchedVideos?.includes(video._id.toString());
        if (alreadyWatched) continue;
        
        const bogxEarned = 0.15;
        botBogx += bogxEarned;
        stats.videosWatched++;
        stats.totalBogxEarned += bogxEarned;
        
        await User.findByIdAndUpdate(bot._id, {
          $addToSet: { watchedVideos: video._id.toString() },
          $inc: { bogxCoins: bogxEarned }
        });
        
        await GameResult.create({
          userId: bot._id.toString(),
          username: bot.username,
          cardId: `video-${video._id}`,
          question: `Watched: ${video.title}`,
          userAnswer: 'watched',
          correctAnswer: 'watched',
          gameDate: targetDate,
          isCorrect: true,
          pointsChange: bogxEarned,
          pointsBefore: botBogx - bogxEarned,
          pointsAfter: botBogx,
        });
      }
      
      // 3. REACT TO ARTICLES (1-3 per day, earn 0.02 BOGX each)
      const reactionsToAdd = Math.floor((Math.random() * 3 + 1) * multiplier);
      
      for (let i = 0; i < Math.min(reactionsToAdd, shuffledArticles.length); i++) {
        const article = shuffledArticles[i];
        const emoji = EMOJI_OPTIONS[Math.floor(Math.random() * EMOJI_OPTIONS.length)];
        
        // Check if bot already reacted to this article
        const existingReaction = await Reaction.findOne({
          articleId: article._id.toString(),
          odooUserId: bot._id.toString(),
        });
        
        if (existingReaction) continue;
        
        const bogxEarned = 0.02;
        botBogx += bogxEarned;
        stats.reactionsAdded++;
        stats.totalBogxEarned += bogxEarned;
        
        await Reaction.create({
          articleId: article._id.toString(),
          odooUserId: bot._id.toString(),
          emoji,
          rewarded: true,
        });
        
        await User.findByIdAndUpdate(bot._id, {
          $inc: { bogxCoins: bogxEarned }
        });
        
        // Update article reaction count
        await Article.findByIdAndUpdate(article._id, {
          $inc: { [`reactions.${emoji}`]: 1 }
        });
      }
      
      // 4. PLAY TRIVIA (2-8 games per day)
      const gamesToPlay = Math.floor((Math.random() * 7 + 2) * multiplier);
      
      for (let i = 0; i < gamesToPlay; i++) {
        // 55-70% win rate
        const botSkill = 0.55 + Math.random() * 0.15;
        const isCorrect = Math.random() < botSkill;
        
        const difficulty = [1, 2, 3][Math.floor(Math.random() * 3)];
        const maxReward = 0.10 * difficulty;
        const penalty = difficulty === 1 ? 0.01 : difficulty === 2 ? 0.05 : 0.10;
        
        const rawChange = isCorrect
          ? Math.round((maxReward * (0.5 + Math.random() * 0.5)) * 100) / 100
          : -penalty;
        
        // Don't go below 0
        const pointsChange = Math.max(-botBogx, rawChange);
        botBogx += pointsChange;
        
        stats.gamesPlayed++;
        if (pointsChange > 0) stats.totalBogxEarned += pointsChange;
        
        await GameResult.create({
          userId: bot._id.toString(),
          username: bot.username,
          cardId: `trivia-${Date.now()}-${i}`,
          question: 'Bot trivia game',
          userAnswer: isCorrect ? 'correct' : 'wrong',
          correctAnswer: 'correct',
          gameDate: targetDate,
          isCorrect,
          pointsChange,
          pointsBefore: botBogx - pointsChange,
          pointsAfter: botBogx,
          difficulty,
        });
        
        await User.findByIdAndUpdate(bot._id, {
          $inc: {
            bogxCoins: pointsChange,
            gamesPlayed: 1,
            wins: isCorrect ? 1 : 0,
          }
        });
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      date: targetDate,
      intensity,
      totalBots: bots.length,
      ...stats,
      message: `${stats.botsActive} bots active: ${stats.articlesRead} articles, ${stats.videosWatched} videos, ${stats.reactionsAdded} reactions, ${stats.gamesPlayed} games`
    });
  } catch (error: any) {
    console.error('Bot daily activity error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

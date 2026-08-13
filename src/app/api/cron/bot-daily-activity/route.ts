import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';
import Article from '@/models/Article';
import GameResult from '@/models/GameResult';
import Reaction from '@/models/Reaction';
import Comment from '@/models/Comment';
import CommentLike from '@/models/CommentLike';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Bot Daily Activity - Simulates realistic user behavior
 * Called by cron job or manually to make bots behave like real users
 * 
 * Activities:
 * - Read articles (earn BOGX)
 * - Watch videos (earn BOGX)
 * - React to articles with emojis (earn BOGX)
 * - Play trivia games (earn/lose BOGX)
 * - Create battles (if enough coins)
 * - Accept/challenge other bots
 */

const BATTLE_TOPICS = ['music', 'sports', 'movies', 'gaming', 'culture', '80s', '90s'];
const MIN_COINS_FOR_BATTLE = 1; // Minimum coins needed to create a battle

// Generate a contextual comment for an article using GPT
async function generateBotComment(articleTitle: string, articleCategory?: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a Gen X user (born 1965-1980) commenting on articles about pop culture, music, movies, sports, and nostalgia.
Write ONE short comment (max 100 characters) that sounds like a real person reacting to this article.
Be authentic - sometimes nostalgic, sometimes witty, sometimes sarcastic.
Reference specific things from the article title when possible.
Use occasional emojis (🎸🔥😎👏) but not always.
Never be generic. Make it feel personal and specific to THIS article.
Just output the comment text, nothing else.`
        },
        {
          role: 'user',
          content: `Article: "${articleTitle}"${articleCategory ? ` (Category: ${articleCategory})` : ''}`
        }
      ],
      max_tokens: 50,
      temperature: 0.9,
    });
    
    return response.choices[0]?.message?.content?.trim() || "This takes me back!";
  } catch (error) {
    console.error('Error generating bot comment:', error);
    // Fallback to generic comments if API fails
    const fallbacks = [
      "This takes me back!",
      "Classic!",
      "The good old days...",
      "Legend status 🔥",
      "Peak culture right here",
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }
}

// Use the same mood IDs as the frontend (from config/moods.ts)
// Weighted distribution: more positive reactions (cool, fire) than negative (whatever, meh)
const MOOD_IDS = ['whatever', 'meh', 'ok', 'cool', 'fire'];
const MOOD_WEIGHTS = [0.05, 0.10, 0.25, 0.35, 0.25]; // whatever=5%, meh=10%, ok=25%, cool=35%, fire=25%

function getWeightedMood(): string {
  const random = Math.random();
  let cumulative = 0;
  for (let i = 0; i < MOOD_IDS.length; i++) {
    cumulative += MOOD_WEIGHTS[i];
    if (random < cumulative) return MOOD_IDS[i];
  }
  return MOOD_IDS[3]; // fallback to 'cool'
}

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
      .select('_id title contentType category mainCategory')
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
      commentsAdded: 0,
      gamesPlayed: 0,
      battlesCreated: 0,
      battlesChallenged: 0,
      totalBogxEarned: 0,
    };
    
    for (const bot of bots) {
      // Only 20-40% of bots do something each minute (realistic pacing)
      const activityChance = 0.2 + Math.random() * 0.2;
      if (Math.random() > activityChance) continue;
      
      stats.botsActive++;
      let botBogx = bot.bogxCoins || 0;
      
      // 1. READ ARTICLES (0-1 per minute, earn 0.05 BOGX each)
      const articlesToRead = Math.random() < 0.3 ? 1 : 0;
      const shuffledArticles = [...articles].sort(() => Math.random() - 0.5);
      
      for (let i = 0; i < Math.min(articlesToRead, shuffledArticles.length); i++) {
        const article = shuffledArticles[i];
        
        // Check if bot already read this article
        const alreadyRead = bot.readArticles?.includes(article._id.toString());
        if (alreadyRead) continue;
        
        // Award BOGX for reading (same as real users: 0.05)
        const bogxEarned = 0.05;
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
        
        const bogxEarned = 0.05; // Same as articles
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
      
      // 3. REACT TO ARTICLES (0-1 per minute, earn 0.01 BOGX each)
      const reactionsToAdd = Math.random() < 0.2 ? 1 : 0;
      
      for (let i = 0; i < Math.min(reactionsToAdd, shuffledArticles.length); i++) {
        const article = shuffledArticles[i];
        const emoji = getWeightedMood();
        
        // Check if bot already reacted to this article
        const existingReaction = await Reaction.findOne({
          articleId: article._id,
          userId: bot._id,
        });
        
        if (existingReaction) continue;
        
        const bogxEarned = 0.01; // Reactions give less
        botBogx += bogxEarned;
        stats.reactionsAdded++;
        stats.totalBogxEarned += bogxEarned;
        
        await Reaction.create({
          articleId: article._id,
          userId: bot._id,
          emojiId: emoji,
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
      
      // 3b. WRITE COMMENTS (40% chance per active bot - bots are chatty!)
      if (Math.random() < 0.4) {
        const articleToComment = shuffledArticles[Math.floor(Math.random() * Math.min(10, shuffledArticles.length))];
        
        // Check if bot already commented on this article
        const existingComment = await Comment.findOne({
          articleId: articleToComment._id,
          userId: bot._id,
        });
        
        if (!existingComment) {
          // Generate a contextual comment using GPT
          const comment = await generateBotComment(
            articleToComment.title,
            articleToComment.category || articleToComment.mainCategory
          );
          
          await Comment.create({
            articleId: articleToComment._id,
            userId: bot._id,
            userName: bot.username,
            userAvatar: bot.avatar || '',
            content: comment,
            likes: 0,
          });
          
          // Update article comment count
          await Article.findByIdAndUpdate(articleToComment._id, {
            $inc: { commentsCount: 1 }
          });
          
          stats.commentsAdded++;
        }
      }
      
      // 3c. LIKE OTHER COMMENTS (50% chance - bots interact with each other)
      if (Math.random() < 0.5) {
        // Find random comments from other users (not this bot)
        const otherComments = await Comment.find({
          userId: { $ne: bot._id },
        }).limit(50).lean();
        
        if (otherComments.length > 0) {
          // Like 1-3 random comments
          const commentsToLike = Math.floor(Math.random() * 3) + 1;
          const shuffledComments = [...otherComments].sort(() => Math.random() - 0.5);
          
          for (let i = 0; i < Math.min(commentsToLike, shuffledComments.length); i++) {
            const commentToLike = shuffledComments[i];
            
            // Check if bot already liked this comment
            const existingLike = await CommentLike.findOne({
              commentId: commentToLike._id,
              userId: bot._id,
            });
            
            if (!existingLike) {
              // Create like record and increment count
              await CommentLike.create({
                commentId: commentToLike._id,
                userId: bot._id,
              });
              await Comment.findByIdAndUpdate(commentToLike._id, {
                $inc: { likes: 1 }
              });
            }
          }
        }
      }
      
      // 4. PLAY TRIVIA (0-1 per minute)
      const gamesToPlay = Math.random() < 0.4 ? 1 : 0;
      
      for (let i = 0; i < gamesToPlay; i++) {
        // 55-70% win rate
        const botSkill = 0.55 + Math.random() * 0.15;
        const isCorrect = Math.random() < botSkill;
        
        const difficulty = [1, 2, 3][Math.floor(Math.random() * 3)];
        // Realistic rewards: 0.02-0.06 per correct answer
        const maxReward = 0.02 * difficulty; // 0.02, 0.04, 0.06
        const penalty = difficulty === 1 ? 0.01 : difficulty === 2 ? 0.02 : 0.03;
        
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
      
      // Refresh bot coins after trivia
      const updatedBot = await User.findById(bot._id).select('bogxCoins');
      botBogx = updatedBot?.bogxCoins || botBogx;
      
      // 5. BATTLES - Only if bot has enough coins (min 5 BOGX to play safe)
      if (botBogx >= 5) {
        // 40% chance to create a battle with high intensity
        if (Math.random() < 0.4 * multiplier) {
          const topic = BATTLE_TOPICS[Math.floor(Math.random() * BATTLE_TOPICS.length)];
          // Wager between 0.5 and 2 BOGX (reasonable for bots)
          const wager = Math.min(Math.max(0.5, Math.round(botBogx * 0.1 * 100) / 100), 2);
          
          if (wager >= 0.5) {
            try {
              // Find another bot to challenge (not self)
              const otherBots = bots.filter(b => 
                b._id.toString() !== bot._id.toString() && 
                (b.bogxCoins || 0) >= wager
              );
              
              if (otherBots.length > 0) {
                const opponent = otherBots[Math.floor(Math.random() * otherBots.length)];
                
                // Create battle via API
                const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
                const res = await fetch(`${baseUrl}/api/battles`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    creatorId: bot._id.toString(),
                    topic,
                    wager,
                    rounds: 5,
                    isPrivate: true,
                    challengedUserId: opponent._id.toString(),
                    source: 'bot-activity',
                  }),
                });
                
                if (res.ok) {
                  stats.battlesChallenged++;
                  botBogx -= wager;
                }
              } else {
                // No opponent available, create public battle
                const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
                const res = await fetch(`${baseUrl}/api/battles`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    creatorId: bot._id.toString(),
                    topic,
                    wager,
                    rounds: 5,
                    isPrivate: false,
                    source: 'bot-activity',
                  }),
                });
                
                if (res.ok) {
                  stats.battlesCreated++;
                  botBogx -= wager;
                }
              }
            } catch (e) {
              // Ignore battle creation errors
            }
          }
        }
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      date: targetDate,
      intensity,
      totalBots: bots.length,
      ...stats,
      message: `${stats.botsActive} bots active: ${stats.articlesRead} articles, ${stats.videosWatched} videos, ${stats.reactionsAdded} reactions, ${stats.commentsAdded} comments, ${stats.gamesPlayed} trivia, ${stats.battlesCreated} battles created, ${stats.battlesChallenged} challenges sent`
    });
  } catch (error: any) {
    console.error('Bot daily activity error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

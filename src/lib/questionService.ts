import crypto from 'crypto';
import Card from '@/models/Card';
import UserQuestionHistory from '@/models/UserQuestionHistory';
import UsedTopic from '@/models/UsedTopic';
import mongoose from 'mongoose';

/**
 * Generate a hash from question text for duplicate detection
 * Normalizes the text (lowercase, remove punctuation) before hashing
 */
export function generateQuestionHash(questionText: string): string {
  const normalized = questionText
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ')        // Normalize whitespace
    .trim();
  
  return crypto.createHash('md5').update(normalized).digest('hex');
}

/**
 * Check if a similar question already exists in the database
 * Returns the existing card if found, null otherwise
 */
export async function findDuplicateQuestion(questionText: string): Promise<any | null> {
  const hash = generateQuestionHash(questionText);
  
  // First check by hash (fast)
  const existingByHash = await Card.findOne({ questionHash: hash });
  if (existingByHash) {
    return existingByHash;
  }
  
  // Also check questions array for older cards without hash
  const normalizedQuestion = questionText.toLowerCase().trim();
  const existingByText = await Card.findOne({
    'questions.question': { $regex: new RegExp(`^${escapeRegex(normalizedQuestion)}$`, 'i') }
  });
  
  return existingByText || null;
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Get questions for a user that they haven't seen recently
 * Prioritizes unseen questions, then oldest seen questions
 */
export async function getQuestionsForUser(
  userId: string,
  options: {
    theme?: string;
    count?: number;
    excludeCardIds?: string[];
    context?: 'game' | 'battle';
  } = {}
): Promise<any[]> {
  const { theme, count = 10, excludeCardIds = [], context = 'game' } = options;
  
  // Build base query
  const query: any = { active: true };
  if (theme && theme !== 'MIX') {
    query.theme = theme;
  }
  if (excludeCardIds.length > 0) {
    query._id = { $nin: excludeCardIds.map(id => new mongoose.Types.ObjectId(id)) };
  }
  
  // Get cards the user has already seen (skip for guests - userId is not a valid ObjectId)
  const isValidObjectId = mongoose.Types.ObjectId.isValid(userId);
  const seenHistory = isValidObjectId
    ? await UserQuestionHistory.find({ userId })
        .select('cardId answeredAt')
        .sort({ answeredAt: -1 })
        .lean()
    : [];
  
  const seenCardIds = new Set(seenHistory.map(h => h.cardId.toString()));
  
  // Get all matching cards
  const allCards = await Card.find(query).lean();
  
  // Separate into unseen and seen
  const unseenCards = allCards.filter(c => !seenCardIds.has(c._id.toString()));
  const seenCards = allCards.filter(c => seenCardIds.has(c._id.toString()));
  
  // Sort seen cards by when they were last seen (oldest first for recycling)
  const seenCardMap = new Map(seenHistory.map(h => [h.cardId.toString(), h.answeredAt]));
  seenCards.sort((a, b) => {
    const aDate = seenCardMap.get(a._id.toString()) || new Date(0);
    const bDate = seenCardMap.get(b._id.toString()) || new Date(0);
    return new Date(aDate).getTime() - new Date(bDate).getTime();
  });
  
  // Prioritize unseen, then add oldest seen if needed
  const result: any[] = [];
  
  // Shuffle unseen cards
  const shuffledUnseen = unseenCards.sort(() => Math.random() - 0.5);
  result.push(...shuffledUnseen.slice(0, count));
  
  // If not enough, add from seen (oldest first)
  if (result.length < count) {
    const remaining = count - result.length;
    result.push(...seenCards.slice(0, remaining));
  }
  
  return result;
}

/**
 * Record that a user answered a question
 */
export async function recordQuestionAnswer(
  userId: string,
  cardId: string,
  questionText: string,
  correct: boolean,
  context: 'game' | 'battle' = 'game',
  battleId?: string
): Promise<void> {
  const questionHash = generateQuestionHash(questionText);
  
  // Record in history
  await UserQuestionHistory.create({
    userId,
    cardId,
    questionHash,
    correct,
    context,
    battleId,
    answeredAt: new Date(),
  });
  
  // Update card stats
  await Card.findByIdAndUpdate(cardId, {
    $inc: {
      timesPlayed: 1,
      timesCorrect: correct ? 1 : 0,
    }
  });
}

/**
 * Get stats for a card
 */
export async function getCardStats(cardId: string): Promise<{
  timesPlayed: number;
  timesCorrect: number;
  successRate: number;
}> {
  const card = await Card.findById(cardId).select('timesPlayed timesCorrect').lean();
  
  if (!card) {
    return { timesPlayed: 0, timesCorrect: 0, successRate: 0 };
  }
  
  const timesPlayed = card.timesPlayed || 0;
  const timesCorrect = card.timesCorrect || 0;
  const successRate = timesPlayed > 0 ? (timesCorrect / timesPlayed) * 100 : 0;
  
  return { timesPlayed, timesCorrect, successRate };
}

/**
 * Check if a question should be created or if it's a duplicate
 * Returns { isDuplicate: boolean, existingCard?: Card }
 */
export async function checkAndPrepareQuestion(
  questionText: string,
  options: any
): Promise<{ isDuplicate: boolean; existingCard?: any; hash: string }> {
  const hash = generateQuestionHash(questionText);
  const existingCard = await findDuplicateQuestion(questionText);
  
  return {
    isDuplicate: !!existingCard,
    existingCard,
    hash,
  };
}

/**
 * Normalize a topic string for comparison
 */
function normalizeTopic(topic: string): string {
  return topic.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
}

/**
 * Record that a topic was used (for avoiding repetition)
 */
export async function recordUsedTopic(topic: string, theme: string): Promise<void> {
  const normalizedTopic = normalizeTopic(topic);
  
  try {
    await UsedTopic.findOneAndUpdate(
      { normalizedTopic, theme },
      { 
        $set: { topic, theme, normalizedTopic, lastUsedAt: new Date() },
        $inc: { timesUsed: 1 }
      },
      { upsert: true }
    );
  } catch (error) {
    console.error('Error recording used topic:', error);
  }
}

/**
 * Get all used topics for a theme (for avoiding repetition)
 * Returns topics used in the last N days
 */
export async function getUsedTopics(options: {
  theme?: string;
  days?: number;
  limit?: number;
} = {}): Promise<string[]> {
  const { theme, days = 30, limit = 500 } = options;
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  const query: any = { lastUsedAt: { $gte: cutoffDate } };
  if (theme) {
    query.theme = theme;
  }
  
  const topics = await UsedTopic.find(query)
    .select('topic')
    .sort({ lastUsedAt: -1 })
    .limit(limit)
    .lean();
  
  return topics.map(t => t.topic);
}

/**
 * Get all unique topics from existing cards (for initial population)
 */
export async function getAllExistingTopics(): Promise<string[]> {
  const cards = await Card.find({}).select('topic').lean();
  const topics = cards.map((c: any) => c.topic).filter(Boolean);
  return Array.from(new Set(topics));
}

/**
 * Build avoid list for ChatGPT prompt
 */
export async function buildAvoidList(theme?: string): Promise<string> {
  const usedTopics = await getUsedTopics({ theme, days: 30, limit: 200 });
  
  if (usedTopics.length === 0) {
    return '';
  }
  
  return `\n\nWICHTIG - Diese ${usedTopics.length} Themen wurden kürzlich verwendet, NICHT nochmal benutzen:\n${usedTopics.map(t => `- ${t}`).join('\n')}\n\nWähle etwas KOMPLETT ANDERES!`;
}

import crypto from 'crypto';
import Question from '@/models/Question';
import UserQuestionHistory from '@/models/UserQuestionHistory';
import UsedTopic from '@/models/UsedTopic';
import mongoose from 'mongoose';

/**
 * Generate a hash from question text for duplicate detection
 */
export function generateQuestionHash(questionText: string): string {
  const normalized = questionText
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  return crypto.createHash('md5').update(normalized).digest('hex');
}

/**
 * Check if a similar question already exists
 */
export async function findDuplicateQuestion(questionText: string): Promise<any | null> {
  const hash = generateQuestionHash(questionText);
  
  const existing = await Question.findOne({ questionHash: hash });
  if (existing) return existing;
  
  // Also check by exact text
  const normalizedQuestion = questionText.toLowerCase().trim();
  const existingByText = await Question.findOne({
    question: { $regex: new RegExp(`^${escapeRegex(normalizedQuestion)}$`, 'i') }
  });
  
  return existingByText || null;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Get questions for a user that they haven't seen recently
 */
export async function getQuestionsForUser(
  userId: string,
  options: {
    theme?: string;
    count?: number;
    excludeIds?: string[];
    context?: 'game' | 'battle';
  } = {}
): Promise<any[]> {
  const { theme, count = 10, excludeIds = [], context = 'game' } = options;
  
  // Build query
  const query: any = { active: true };
  if (theme && theme !== 'MIX') {
    query.theme = theme;
  }
  if (excludeIds.length > 0) {
    query._id = { $nin: excludeIds.map(id => new mongoose.Types.ObjectId(id)) };
  }
  
  // Get questions the user has seen
  const isValidObjectId = mongoose.Types.ObjectId.isValid(userId);
  const seenHistory = isValidObjectId
    ? await UserQuestionHistory.find({ userId })
        .select('questionId answeredAt')
        .sort({ answeredAt: -1 })
        .lean()
    : [];
  
  const seenIds = new Set(
    seenHistory
      .filter(h => h.questionId)
      .map(h => h.questionId!.toString())
  );
  
  // Get all matching questions
  const allQuestions = await Question.find(query).lean();
  
  // Separate into unseen and seen
  const unseenQuestions = allQuestions.filter(q => !seenIds.has(q._id.toString()));
  const seenQuestions = allQuestions.filter(q => seenIds.has(q._id.toString()));
  
  // Sort seen by oldest first
  const seenMap = new Map(
    seenHistory
      .filter(h => h.questionId)
      .map(h => [h.questionId!.toString(), h.answeredAt])
  );
  seenQuestions.sort((a, b) => {
    const aDate = seenMap.get(a._id.toString()) || new Date(0);
    const bDate = seenMap.get(b._id.toString()) || new Date(0);
    return new Date(aDate).getTime() - new Date(bDate).getTime();
  });
  
  // Prioritize unseen, then oldest seen
  const result: any[] = [];
  
  const shuffledUnseen = unseenQuestions.sort(() => Math.random() - 0.5);
  result.push(...shuffledUnseen.slice(0, count));
  
  if (result.length < count) {
    const remaining = count - result.length;
    result.push(...seenQuestions.slice(0, remaining));
  }
  
  return result;
}

/**
 * Record that a user answered a question
 */
export async function recordQuestionAnswer(
  userId: string,
  questionId: string,
  questionText: string,
  correct: boolean,
  context: 'game' | 'battle' = 'game',
  battleId?: string
): Promise<void> {
  const questionHash = generateQuestionHash(questionText);
  
  await UserQuestionHistory.create({
    userId,
    questionId,
    questionHash,
    correct,
    context,
    battleId,
    answeredAt: new Date(),
  });
  
  // Update question stats
  await Question.findByIdAndUpdate(questionId, {
    $inc: {
      timesPlayed: 1,
      timesCorrect: correct ? 1 : 0,
    }
  });
}

/**
 * Get stats for a question
 */
export async function getQuestionStats(questionId: string): Promise<{
  timesPlayed: number;
  timesCorrect: number;
  successRate: number;
}> {
  const question = await Question.findById(questionId).select('timesPlayed timesCorrect').lean();
  
  if (!question) {
    return { timesPlayed: 0, timesCorrect: 0, successRate: 0 };
  }
  
  const timesPlayed = question.timesPlayed || 0;
  const timesCorrect = question.timesCorrect || 0;
  const successRate = timesPlayed > 0 ? (timesCorrect / timesPlayed) * 100 : 0;
  
  return { timesPlayed, timesCorrect, successRate };
}

/**
 * Check if a question is a duplicate
 */
export async function checkAndPrepareQuestion(
  questionText: string,
  options: any
): Promise<{ isDuplicate: boolean; existingQuestion?: any; hash: string }> {
  const hash = generateQuestionHash(questionText);
  const existingQuestion = await findDuplicateQuestion(questionText);
  
  return {
    isDuplicate: !!existingQuestion,
    existingQuestion,
    hash,
  };
}

function normalizeTopic(topic: string): string {
  return topic.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
}

/**
 * Record that a topic was used
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
 * Get used topics for avoiding repetition
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
  if (theme) query.theme = theme;
  
  const topics = await UsedTopic.find(query)
    .select('topic')
    .sort({ lastUsedAt: -1 })
    .limit(limit)
    .lean();
  
  return topics.map(t => t.topic);
}

/**
 * Get all unique topics from existing questions
 */
export async function getAllExistingTopics(): Promise<string[]> {
  const questions = await Question.find({}).select('topic').lean();
  const topics = questions.map((q: any) => q.topic).filter(Boolean);
  return Array.from(new Set(topics));
}

/**
 * Build avoid list for prompts
 */
export async function buildAvoidList(theme?: string): Promise<string> {
  const usedTopics = await getUsedTopics({ theme, days: 30, limit: 200 });
  
  if (usedTopics.length === 0) return '';
  
  return `\n\nIMPORTANT - These ${usedTopics.length} topics were recently used, DO NOT use again:\n${usedTopics.map(t => `- ${t}`).join('\n')}\n\nChoose something COMPLETELY DIFFERENT!`;
}

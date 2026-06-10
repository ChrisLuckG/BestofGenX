import mongoose from 'mongoose';

// Simple poll option (for single-question polls)
export interface IPollOption {
  id: string;
  label: string;
  emoji?: string;
  votes: number;
}

// Ranking list item (for up/down voting lists)
export interface IRankingItem {
  id: string;
  title: string;
  description?: string;
  image?: string;
  upvotes: number;
  downvotes: number;
  score: number; // upvotes - downvotes, used for sorting
}

// Quiz question with answers that map to result types
export interface IQuizQuestion {
  id: string;
  question: string;
  image?: string;
  answers: {
    id: string;
    text: string;
    emoji?: string;
    resultType: string; // e.g., "bee", "ant", "medium"
  }[];
}

// Result type definition (e.g., BEE, ANT, MEDIUM)
export interface IResultType {
  id: string;
  label: string;
  emoji?: string;
  description?: string;
  votes: number; // Total users who got this result
}

export interface IPoll {
  _id: string;
  title: string;
  subtitle?: string;
  description?: string;
  image?: string;
  // For simple polls (single question)
  options: IPollOption[];
  // For quiz/personality tests (multiple questions)
  questions?: IQuizQuestion[];
  resultTypes?: IResultType[];
  // For ranking lists (up/down voting)
  items?: IRankingItem[];
  totalVotes: number;
  linkedArticleId?: mongoose.Types.ObjectId;
  category: 'general' | 'personality' | 'opinion' | 'prediction' | 'ranking';
  type: 'simple' | 'quiz' | 'ranking'; // simple = 1 question, quiz = multiple questions, ranking = up/down list
  status: 'active' | 'closed' | 'draft';
  featured: boolean;
  createdAt: Date;
  closesAt?: Date;
}

const PollOptionSchema = new mongoose.Schema({
  id: { type: String, required: true },
  label: { type: String, required: true },
  emoji: { type: String },
  votes: { type: Number, default: 0 },
}, { _id: false });

const QuizAnswerSchema = new mongoose.Schema({
  id: { type: String, required: true },
  text: { type: String, required: true },
  emoji: { type: String },
  resultType: { type: String, required: true }, // Maps to resultTypes.id
}, { _id: false });

const QuizQuestionSchema = new mongoose.Schema({
  id: { type: String, required: true },
  question: { type: String, required: true },
  image: { type: String },
  answers: { type: [QuizAnswerSchema], required: true },
}, { _id: false });

const ResultTypeSchema = new mongoose.Schema({
  id: { type: String, required: true },
  label: { type: String, required: true },
  emoji: { type: String },
  description: { type: String },
  votes: { type: Number, default: 0 },
}, { _id: false });

const RankingItemSchema = new mongoose.Schema({
  id: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String },
  image: { type: String },
  upvotes: { type: Number, default: 0 },
  downvotes: { type: Number, default: 0 },
  score: { type: Number, default: 0 }, // upvotes - downvotes
}, { _id: false });

const PollSchema = new mongoose.Schema({
  title: { type: String, required: true },
  subtitle: { type: String },
  description: { type: String },
  image: { type: String },
  // Simple poll options
  options: { type: [PollOptionSchema], default: [] },
  // Quiz questions and results
  questions: { type: [QuizQuestionSchema], default: [] },
  resultTypes: { type: [ResultTypeSchema], default: [] },
  // Ranking list items
  items: { type: [RankingItemSchema], default: [] },
  totalVotes: { type: Number, default: 0 },
  linkedArticleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Article' },
  category: { 
    type: String, 
    enum: ['general', 'personality', 'opinion', 'prediction', 'ranking'],
    default: 'general'
  },
  type: {
    type: String,
    enum: ['simple', 'quiz', 'ranking'],
    default: 'simple'
  },
  status: { 
    type: String, 
    enum: ['active', 'closed', 'draft'],
    default: 'active'
  },
  featured: { type: Boolean, default: false },
  closesAt: { type: Date },
}, { timestamps: true });

export default mongoose.models.Poll || mongoose.model('Poll', PollSchema);

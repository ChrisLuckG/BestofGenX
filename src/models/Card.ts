import mongoose from 'mongoose';

// Question variant for each difficulty level
export interface IQuestionVariant {
  _id?: string; // Unique question ID
  question: string;
  options: (string | number)[];
  correctAnswer: string | number;
  highlightWords: string[];
  difficulty: number;
  difficultyText: string;
  maxReward: number;
}

export interface ICard {
  _id?: string;
  type: 'quiz' | 'guess' | 'betting';
  theme: string;
  subCategory?: string; // e.g. "Basketball", "Football" for SPORTS theme
  topic: string;
  questions: IQuestionVariant[]; // Array of Easy/Medium/Hard variants
  timeLimit: number;
  previewImage?: string;
  playerImage?: string;
  active: boolean;
  guestCard: boolean; // If true, this card is shown to unlogged guests (first 5)
  gameDate?: string; // Date for which this card is scheduled (YYYY-MM-DD format)
  questionHash?: string; // Hash of question text for duplicate detection
  timesPlayed: number; // How many times this card has been played
  timesCorrect: number; // How many times answered correctly
  source: 'admin' | 'battle' | 'generated'; // Where the card came from
  createdAt?: Date;
  updatedAt?: Date;
}

const QuestionVariantSchema = new mongoose.Schema({
  question: { type: String, required: true },
  options: { type: [mongoose.Schema.Types.Mixed], required: true },
  correctAnswer: { type: mongoose.Schema.Types.Mixed, required: true },
  highlightWords: { type: [String], default: [] },
  difficulty: { type: Number, min: 1, max: 5, default: 3 },
  difficultyText: { type: String, default: 'Medium' },
  maxReward: { type: Number, default: 0.10 }, // BOGX
}); // _id: true (default) - each question gets its own unique ID

const CardSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['quiz', 'guess', 'betting'],
    required: true,
    default: 'quiz',
  },
  theme: {
    type: String,
    required: true,
    default: 'MUSIC',
  },
  subCategory: {
    type: String,
    default: '',
  },
  topic: {
    type: String,
    required: true,
    default: '',
  },
  questions: {
    type: [QuestionVariantSchema],
    required: true,
    validate: {
      validator: function(v: IQuestionVariant[]) {
        return v && v.length > 0;
      },
      message: 'At least one question variant is required'
    }
  },
  timeLimit: {
    type: Number,
    default: 10,
  },
  previewImage: {
    type: String,
    default: '',
  },
  playerImage: {
    type: String,
    default: '',
  },
  active: {
    type: Boolean,
    default: true,
  },
  guestCard: {
    type: Boolean,
    default: false, // By default, cards are for logged-in users only
  },
  gameDate: {
    type: String,
    default: () => new Date().toISOString().split('T')[0], // Default to today
  },
  questionHash: {
    type: String,
    index: true, // For fast duplicate lookups
  },
  timesPlayed: {
    type: Number,
    default: 0,
  },
  timesCorrect: {
    type: Number,
    default: 0,
  },
  source: {
    type: String,
    enum: ['admin', 'battle', 'generated'],
    default: 'admin',
  },
}, {
  timestamps: true,
});

// Delete cached model to force reload with new schema
if (mongoose.models.Card) {
  delete mongoose.models.Card;
}

export default mongoose.model<ICard>('Card', CardSchema);

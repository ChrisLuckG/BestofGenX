import mongoose from 'mongoose';

export interface IArcadeGame {
  _id?: string;
  title: string;
  description?: string;
  coverImage?: string;
  category: string;  // e.g. "Best of 90s", "Music Legends", "Movie Trivia"
  cards: mongoose.Types.ObjectId[];  // Quiz cards in this game
  difficulty: 'easy' | 'medium' | 'hard';
  entryFee: number;  // Coins needed to play
  maxReward: number;  // Max coins to win
  playCount: number;
  avgScore: number;
  active: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const ArcadeGameSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  coverImage: {
    type: String,
    default: '',
  },
  category: {
    type: String,
    required: true,
    default: 'General',
  },
  cards: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Card',
  }],
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium',
  },
  entryFee: {
    type: Number,
    default: 50,
  },
  maxReward: {
    type: Number,
    default: 500,
  },
  playCount: {
    type: Number,
    default: 0,
  },
  avgScore: {
    type: Number,
    default: 0,
  },
  active: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

// Indexes
ArcadeGameSchema.index({ category: 1, active: 1 });
ArcadeGameSchema.index({ playCount: -1 });

export default mongoose.models.ArcadeGame || mongoose.model<IArcadeGame>('ArcadeGame', ArcadeGameSchema);

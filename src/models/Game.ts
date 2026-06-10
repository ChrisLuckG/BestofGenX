import mongoose, { Schema, Document } from 'mongoose';

export interface IGame extends Document {
  gameNumber: number; // Game 1, Game 2, etc.
  date: string; // YYYY-MM-DD
  displayDate: string; // "29.05.2026" for display
  status: 'upcoming' | 'active' | 'completed';
  totalPlayers: number;
  totalCards: number;
  winnerId?: mongoose.Types.ObjectId;
  winnerUsername?: string;
  createdAt: Date;
  completedAt?: Date;
}

const GameSchema = new Schema<IGame>({
  gameNumber: {
    type: Number,
    required: true,
    unique: true,
  },
  date: {
    type: String,
    required: true,
    unique: true, // One game per day
  },
  displayDate: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['upcoming', 'active', 'completed'],
    default: 'upcoming',
  },
  totalPlayers: {
    type: Number,
    default: 0,
  },
  totalCards: {
    type: Number,
    default: 0,
  },
  winnerId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  winnerUsername: String,
  completedAt: Date,
}, {
  timestamps: true,
});

GameSchema.index({ date: 1 });
GameSchema.index({ gameNumber: 1 });
GameSchema.index({ status: 1 });

export default mongoose.models.Game || mongoose.model<IGame>('Game', GameSchema);

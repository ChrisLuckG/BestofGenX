import mongoose, { Schema, Document } from 'mongoose';

export interface IGameResult extends Document {
  userId: string;
  username: string;
  cardId: string;
  question: string;
  userAnswer: string | number | null;
  correctAnswer: string | number;
  isCorrect: boolean;
  pointsChange: number;
  pointsBefore: number;
  pointsAfter: number;
  timeUsed: number;
  difficulty: number; // multiplier: 1=easy, 2=medium, 3=hard
  skipped: boolean;
  timedOut: boolean;
  playedAt: Date;
  gameDate: string; // YYYY-MM-DD
}

const GameResultSchema = new Schema<IGameResult>({
  userId:        { type: String, required: true, index: true },
  username:      { type: String, required: true },
  cardId:        { type: String, required: true },
  question:      { type: String, required: true },
  userAnswer:    { type: Schema.Types.Mixed, default: null },
  correctAnswer: { type: Schema.Types.Mixed, required: true },
  isCorrect:     { type: Boolean, required: true },
  pointsChange:  { type: Number, required: true },
  pointsBefore:  { type: Number, required: true },
  pointsAfter:   { type: Number, required: true },
  timeUsed:      { type: Number, default: 0 },
  difficulty:    { type: Number, default: 1 },
  skipped:       { type: Boolean, default: false },
  timedOut:      { type: Boolean, default: false },
  playedAt:      { type: Date, default: Date.now, index: true },
  gameDate:      { type: String, required: true, index: true },
});

// Compound index for user history queries
GameResultSchema.index({ userId: 1, playedAt: -1 });
GameResultSchema.index({ gameDate: 1, userId: 1 });

export default mongoose.models.GameResult || mongoose.model<IGameResult>('GameResult', GameResultSchema);

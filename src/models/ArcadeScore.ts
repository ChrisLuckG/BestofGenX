import mongoose, { Schema, Document } from 'mongoose';

export interface IArcadeScore extends Document {
  userId: string;
  username: string;
  avatar: string;
  game: string; // e.g. 'bogx-invaders'
  score: number;
  wave: number;
  playedAt: Date;
}

const ArcadeScoreSchema = new Schema<IArcadeScore>({
  userId:   { type: String, required: true, index: true },
  username: { type: String, required: true },
  avatar:   { type: String, default: '/images/default-avatar.png' },
  game:     { type: String, required: true, index: true },
  score:    { type: Number, required: true },
  wave:     { type: Number, default: 1 },
  playedAt: { type: Date, default: Date.now, index: true },
});

// Compound index for leaderboard queries (best score per game)
ArcadeScoreSchema.index({ game: 1, score: -1 });
ArcadeScoreSchema.index({ game: 1, userId: 1, score: -1 });

export default mongoose.models.ArcadeScore || mongoose.model<IArcadeScore>('ArcadeScore', ArcadeScoreSchema);

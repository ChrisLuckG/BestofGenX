import mongoose, { Schema, Document } from 'mongoose';

export type MoodType = 'rock' | 'chill' | 'mindblown' | 'lol' | 'love';

export interface IArticleReaction extends Document {
  articleId: mongoose.Types.ObjectId;
  odlId?: string;
visitorId: string; // For guests: fingerprint/localStorage ID
  mood: MoodType;
  createdAt: Date;
}

const ArticleReactionSchema = new Schema<IArticleReaction>({
  articleId: { type: Schema.Types.ObjectId, ref: 'Article', required: true },
  visitorId: { type: String, required: true },
  mood: { type: String, enum: ['rock', 'chill', 'mindblown', 'lol', 'love'], required: true },
  createdAt: { type: Date, default: Date.now },
});

// One reaction per visitor per article
ArticleReactionSchema.index({ articleId: 1, visitorId: 1 }, { unique: true });

export default mongoose.models.ArticleReaction || mongoose.model<IArticleReaction>('ArticleReaction', ArticleReactionSchema);

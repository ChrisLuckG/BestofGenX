import mongoose from 'mongoose';

export interface IArticleView {
  _id?: string;
  articleId: mongoose.Types.ObjectId | string;
  userId?: mongoose.Types.ObjectId | string | null;
  // Analytics data
  ip?: string;
  country?: string;
  city?: string;
  region?: string;
  device?: 'mobile' | 'tablet' | 'desktop';
  browser?: string;
  os?: string;
  referrer?: string;
  sessionId?: string;
  createdAt?: Date;
}

const ArticleViewSchema = new mongoose.Schema({
  articleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Article',
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  // Analytics
  ip: { type: String },
  country: { type: String },
  city: { type: String },
  region: { type: String },
  device: { type: String, enum: ['mobile', 'tablet', 'desktop'] },
  browser: { type: String },
  os: { type: String },
  referrer: { type: String },
  sessionId: { type: String },
}, {
  timestamps: true,
});

// Index for analytics queries
ArticleViewSchema.index({ articleId: 1, createdAt: -1 });
ArticleViewSchema.index({ articleId: 1, country: 1 });
// Unique per session to avoid duplicate counts
ArticleViewSchema.index({ articleId: 1, sessionId: 1 }, { unique: true, sparse: true });

export default mongoose.models.ArticleView || mongoose.model<IArticleView>('ArticleView', ArticleViewSchema);

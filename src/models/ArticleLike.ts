import mongoose from 'mongoose';

export interface IArticleLike {
  _id?: string;
  articleId: mongoose.Types.ObjectId | string;
  userId: mongoose.Types.ObjectId | string;
  createdAt?: Date;
}

const ArticleLikeSchema = new mongoose.Schema({
  articleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Article',
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, {
  timestamps: true,
});

// Compound index to ensure one like per user per article
ArticleLikeSchema.index({ articleId: 1, userId: 1 }, { unique: true });

export default mongoose.models.ArticleLike || mongoose.model<IArticleLike>('ArticleLike', ArticleLikeSchema);

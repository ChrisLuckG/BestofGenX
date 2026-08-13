import mongoose from 'mongoose';

const CommentLikeSchema = new mongoose.Schema({
  commentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
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

// Ensure a user can only like a comment once
CommentLikeSchema.index({ commentId: 1, userId: 1 }, { unique: true });

export default mongoose.models.CommentLike || mongoose.model('CommentLike', CommentLikeSchema);

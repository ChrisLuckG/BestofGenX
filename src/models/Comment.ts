import mongoose from 'mongoose';

export interface IComment {
  _id?: string;
  articleId: mongoose.Types.ObjectId | string;
  userId: mongoose.Types.ObjectId | string;
  userName: string;
  userAvatar?: string;
  content: string;
  likes: number;
  flagged?: boolean;
  flagReason?: string;
  hidden?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const CommentSchema = new mongoose.Schema({
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
  userName: {
    type: String,
    required: true,
  },
  userAvatar: {
    type: String,
    default: '',
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000,
  },
  likes: {
    type: Number,
    default: 0,
  },
  flagged: {
    type: Boolean,
    default: false,
  },
  flagReason: {
    type: String,
    default: '',
  },
  hidden: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

CommentSchema.index({ articleId: 1, createdAt: -1 });
CommentSchema.index({ userId: 1 });

export default mongoose.models.Comment || mongoose.model<IComment>('Comment', CommentSchema);

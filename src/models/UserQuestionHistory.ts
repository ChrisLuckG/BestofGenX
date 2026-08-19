import mongoose from 'mongoose';

export interface IUserQuestionHistory {
  _id?: string;
  userId: mongoose.Types.ObjectId;
  questionId: mongoose.Types.ObjectId;  // Reference to Question
  cardId?: mongoose.Types.ObjectId;     // Legacy - kept for backwards compatibility
  questionHash: string;
  answeredAt: Date;
  correct: boolean;
  context: 'game' | 'battle';
  battleId?: mongoose.Types.ObjectId;
}

const UserQuestionHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question',
    index: true,
  },
  cardId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Card',
    // Not required anymore - legacy field
  },
  questionHash: {
    type: String,
    required: true,
    index: true,
  },
  answeredAt: {
    type: Date,
    default: Date.now,
  },
  correct: {
    type: Boolean,
    required: true,
  },
  context: {
    type: String,
    enum: ['game', 'battle'],
    default: 'game',
  },
  battleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Battle',
  },
}, {
  timestamps: true,
});

// Compound indexes
UserQuestionHistorySchema.index({ userId: 1, questionId: 1 });
UserQuestionHistorySchema.index({ userId: 1, questionHash: 1 });
UserQuestionHistorySchema.index({ userId: 1, answeredAt: -1 });

// Delete cached model to force reload
if (mongoose.models.UserQuestionHistory) {
  delete mongoose.models.UserQuestionHistory;
}

export default mongoose.model<IUserQuestionHistory>('UserQuestionHistory', UserQuestionHistorySchema);

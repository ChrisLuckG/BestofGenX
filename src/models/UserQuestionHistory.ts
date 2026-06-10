import mongoose from 'mongoose';

export interface IUserQuestionHistory {
  _id?: string;
  userId: mongoose.Types.ObjectId;
  cardId: mongoose.Types.ObjectId;
  questionHash: string; // Hash of the question text for quick lookup
  answeredAt: Date;
  correct: boolean;
  context: 'game' | 'battle'; // Where the question was answered
  battleId?: mongoose.Types.ObjectId; // If answered in a battle
}

const UserQuestionHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  cardId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Card',
    required: true,
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

// Compound index for efficient queries
UserQuestionHistorySchema.index({ userId: 1, cardId: 1 });
UserQuestionHistorySchema.index({ userId: 1, questionHash: 1 });

// Delete cached model to force reload
if (mongoose.models.UserQuestionHistory) {
  delete mongoose.models.UserQuestionHistory;
}

export default mongoose.model<IUserQuestionHistory>('UserQuestionHistory', UserQuestionHistorySchema);

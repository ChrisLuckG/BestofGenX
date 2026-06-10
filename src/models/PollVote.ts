import mongoose from 'mongoose';

export interface IPollVote {
  pollId: mongoose.Types.ObjectId;
  oderId?: string; // visitorId or `user_${userId}` for consistent lookup
  optionId: string; // For simple polls: option id, for rankings: item id
  voteType?: 'up' | 'down'; // For ranking lists only
  createdAt: Date;
}

const PollVoteSchema = new mongoose.Schema({
  pollId: { type: mongoose.Schema.Types.ObjectId, ref: 'Poll', required: true },
  oderId: { type: String }, // visitorId or `user_${userId}` for consistent lookup
  optionId: { type: String, required: true }, // For rankings: this is the item id
  voteType: { type: String, enum: ['up', 'down'] }, // Only for ranking lists
}, { timestamps: true });

// For ranking lists: one vote per user/visitor per item (allows voting on multiple items)
// This compound index ensures uniqueness per poll+item+user combination
PollVoteSchema.index({ pollId: 1, optionId: 1, oderId: 1 }, { unique: true, sparse: true });

export default mongoose.models.PollVote || mongoose.model('PollVote', PollVoteSchema);

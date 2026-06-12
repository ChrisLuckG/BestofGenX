import mongoose from 'mongoose';

export interface IPollReward {
  pollId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  pointsAwarded: number;
  createdAt: Date;
}

const PollRewardSchema = new mongoose.Schema({
  pollId: { type: mongoose.Schema.Types.ObjectId, ref: 'Poll', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  pointsAwarded: { type: Number, required: true, default: 0.05 }, // BOGX
}, { timestamps: true });

// One reward per user per poll
PollRewardSchema.index({ pollId: 1, userId: 1 }, { unique: true });

export default mongoose.models.PollReward || mongoose.model('PollReward', PollRewardSchema);

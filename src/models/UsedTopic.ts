import mongoose from 'mongoose';

export interface IUsedTopic {
  _id?: string;
  topic: string; // e.g. "Michael Jackson", "Nirvana", "Titanic"
  theme: string; // MUSIC, SPORTS, MOVIES, etc.
  normalizedTopic: string; // lowercase, trimmed for matching
  timesUsed: number;
  lastUsedAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const UsedTopicSchema = new mongoose.Schema({
  topic: {
    type: String,
    required: true,
  },
  theme: {
    type: String,
    required: true,
  },
  normalizedTopic: {
    type: String,
    required: true,
    index: true,
  },
  timesUsed: {
    type: Number,
    default: 1,
  },
  lastUsedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Compound index for efficient lookups
UsedTopicSchema.index({ normalizedTopic: 1, theme: 1 }, { unique: true });
UsedTopicSchema.index({ lastUsedAt: -1 });
UsedTopicSchema.index({ theme: 1, lastUsedAt: -1 });

// Delete cached model
if (mongoose.models.UsedTopic) {
  delete mongoose.models.UsedTopic;
}

export default mongoose.model<IUsedTopic>('UsedTopic', UsedTopicSchema);

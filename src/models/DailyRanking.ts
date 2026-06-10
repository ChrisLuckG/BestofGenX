import mongoose, { Schema, Document } from 'mongoose';

export interface IRankingEntry {
  rank: number;
  oderId: mongoose.Types.ObjectId;
  username: string;
  avatar: string;
  country: string;
  countryFlag: string;
  points: number;
  wins: number;
}

export interface IDailyRanking extends Document {
  date: Date;
  dateString: string; // YYYY-MM-DD format for easy querying
  rankings: IRankingEntry[];
  createdAt: Date;
}

const RankingEntrySchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  username: String,
  avatar: String,
  country: String,
  countryFlag: String,
  points: Number,
  wins: Number,
  rank: Number,
});

const DailyRankingSchema = new Schema<IDailyRanking>(
  {
    date: {
      type: Date,
      required: true,
    },
    dateString: {
      type: String,
      required: true,
      unique: true,
    },
    rankings: [RankingEntrySchema],
  },
  {
    timestamps: true,
  }
);

// Index for fast date queries
DailyRankingSchema.index({ dateString: 1 });
DailyRankingSchema.index({ date: -1 });

export default mongoose.models.DailyRanking || mongoose.model<IDailyRanking>('DailyRanking', DailyRankingSchema);

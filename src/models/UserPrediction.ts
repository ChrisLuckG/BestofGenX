import mongoose, { Schema, Document } from 'mongoose';

export interface IUserPrediction extends Document {
  predictionId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  optionId: string; // the option the user picked
  wager: number; // points staked on this prediction
  isCorrect: boolean | null; // null until resolved
  pointsAwarded: number;
  createdAt: Date;
  updatedAt: Date;
}

const UserPredictionSchema = new Schema<IUserPrediction>(
  {
    predictionId: {
      type: Schema.Types.ObjectId,
      ref: 'Prediction',
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    optionId: { type: String, required: true },
    wager: { type: Number, default: 0 },
    isCorrect: { type: Boolean, default: null },
    pointsAwarded: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// One prediction per user per question
UserPredictionSchema.index({ predictionId: 1, userId: 1 }, { unique: true });

export default (mongoose.models.UserPrediction as mongoose.Model<IUserPrediction>) ||
  mongoose.model<IUserPrediction>('UserPrediction', UserPredictionSchema);

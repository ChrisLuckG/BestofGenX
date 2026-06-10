import mongoose, { Schema, Document } from 'mongoose';

interface WelcomeMessage {
  greeting: string;
  subtitle: string;
  facts: string[];  // Array of 3 daily facts
  callToAction: string;
}

export interface IDailyFact extends Document {
  dateKey: string; // e.g. "2026-05-29" (year-month-day), regenerated annually
  welcome: WelcomeMessage; // AI-generated personalized welcome message
  createdAt: Date;
  updatedAt: Date;
}

const DailyFactSchema = new Schema<IDailyFact>(
  {
    dateKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    welcome: {
      type: Schema.Types.Mixed, // { greeting, subtitle, fact, factReaction, callToAction }
      default: null,
    },
  },
  { timestamps: true }
);

export default (mongoose.models.DailyFact as mongoose.Model<IDailyFact>) ||
  mongoose.model<IDailyFact>('DailyFact', DailyFactSchema);

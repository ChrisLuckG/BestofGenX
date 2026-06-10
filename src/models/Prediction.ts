import mongoose, { Schema, Document } from 'mongoose';

export type PredictionCategory =
  | 'sport'
  | 'politics'
  | 'entertainment'
  | 'music'
  | 'tech'
  | 'world'
  | 'weather'
  | 'finance'
  | 'other';

export type PredictionStatus = 'draft' | 'active' | 'resolved' | 'cancelled';

export interface IPredictionOption {
  id: string;
  label: string;
}

export interface IPrediction extends Document {
  question: string;
  category: PredictionCategory;
  options: IPredictionOption[];
  correctOptionId: string | null; // set on resolution
  pointsReward: number; // flat points for a correct prediction
  status: PredictionStatus;
  /** When predictions close (must be before the 9:00 CET resolution break) */
  closesAt: Date;
  /** The day this prediction belongs to (event day) */
  eventDate: Date;
  genXRelated: boolean;
  source: 'bot' | 'manual';
  totalPredictions: number;
  resolvedAt?: Date | null;
  searchQuery?: string; // Query to use when auto-resolving via web search
  referenceValue?: number; // Reference value for comparison (e.g. gold price at creation)
  referenceUnit?: string; // Unit of reference value (e.g. USD, °C)
  createdAt: Date;
  updatedAt: Date;
}

const PredictionOptionSchema = new Schema<IPredictionOption>(
  {
    id: { type: String, required: true },
    label: { type: String, required: true },
  },
  { _id: false }
);

const PredictionSchema = new Schema<IPrediction>(
  {
    question: { type: String, required: true },
    category: {
      type: String,
      enum: ['sport', 'politics', 'entertainment', 'music', 'tech', 'world', 'weather', 'finance', 'other'],
      default: 'other',
    },
    options: { type: [PredictionOptionSchema], required: true },
    correctOptionId: { type: String, default: null },
    pointsReward: { type: Number, default: 100 },
    status: {
      type: String,
      enum: ['draft', 'active', 'resolved', 'cancelled'],
      default: 'draft',
    },
    closesAt: { type: Date, required: true },
    eventDate: { type: Date, required: true },
    genXRelated: { type: Boolean, default: false },
    source: { type: String, enum: ['bot', 'manual'], default: 'bot' },
    totalPredictions: { type: Number, default: 0 },
    resolvedAt: { type: Date, default: null },
    searchQuery: { type: String, default: null },
    referenceValue: { type: Number, default: null },
    referenceUnit: { type: String, default: null },
  },
  { timestamps: true }
);

PredictionSchema.index({ status: 1, closesAt: 1 });
PredictionSchema.index({ eventDate: 1 });

export default (mongoose.models.Prediction as mongoose.Model<IPrediction>) ||
  mongoose.model<IPrediction>('Prediction', PredictionSchema);

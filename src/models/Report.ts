import mongoose, { Schema, Document } from 'mongoose';

export interface IReport extends Document {
  type: 'wrong_answer' | 'inappropriate' | 'other';
  questionId?: string;
  question?: string;
  claimedAnswer?: string;
  userAnswer?: string;
  userId?: string;
  status: 'pending' | 'reviewed' | 'fixed' | 'dismissed';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ReportSchema = new Schema<IReport>(
  {
    type: { type: String, enum: ['wrong_answer', 'inappropriate', 'other'], required: true },
    questionId: { type: String },
    question: { type: String },
    claimedAnswer: { type: String },
    userAnswer: { type: String },
    userId: { type: String },
    status: { type: String, enum: ['pending', 'reviewed', 'fixed', 'dismissed'], default: 'pending' },
    notes: { type: String },
  },
  { timestamps: true }
);

export default mongoose.models.Report || mongoose.model<IReport>('Report', ReportSchema);

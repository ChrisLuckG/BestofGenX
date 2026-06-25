import mongoose, { Schema, Document } from 'mongoose';

export interface IConferenceResult {
  reporterUserId: string;
  reporterName: string;
  taskType: 'article' | 'rankroll' | 'menschen' | 'tv';
  message: string;
  status: 'done' | 'error';
  resultLabel: string;
  // IDs of created content, for undo/delete
  articleId?: string;
  pollId?: string;
  tvVideoIds?: string[];
}

export interface IConferenceSession extends Document {
  campaignTopic: string;
  conferenceType: string;
  status: 'running' | 'completed' | 'partial';
  results: IConferenceResult[];
  createdAt: Date;
  updatedAt: Date;
}

const ConferenceSessionSchema = new Schema<IConferenceSession>(
  {
    campaignTopic: { type: String, required: true },
    conferenceType: { type: String, default: 'campaign' },
    status: { type: String, enum: ['running', 'completed', 'partial'], default: 'running' },
    results: [
      {
        reporterUserId: String,
        reporterName: String,
        taskType: String,
        message: String,
        status: String,
        resultLabel: String,
        articleId: String,
        pollId: String,
        tvVideoIds: [String],
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.models.ConferenceSession ||
  mongoose.model<IConferenceSession>('ConferenceSession', ConferenceSessionSchema);

import mongoose, { Schema, Document } from 'mongoose';

export interface INotificationLog extends Document {
  userId: string;
  username?: string;
  title: string;
  body: string;
  type: string;
  source: string; // Which route/function sent it
  tag?: string;
  url?: string;
  success: boolean;
  error?: string;
  createdAt: Date;
}

const NotificationLogSchema = new Schema<INotificationLog>(
  {
    userId: { type: String, required: true, index: true },
    username: { type: String },
    title: { type: String, required: true },
    body: { type: String, required: true },
    type: { type: String, default: 'general' },
    source: { type: String, required: true }, // e.g. 'battle-challenge', 'game-reminder', 'cron-cleanup'
    tag: { type: String },
    url: { type: String },
    success: { type: Boolean, default: true },
    error: { type: String },
  },
  { timestamps: true }
);

// Index for recent notifications query
NotificationLogSchema.index({ createdAt: -1 });

export default mongoose.models.NotificationLog || mongoose.model<INotificationLog>('NotificationLog', NotificationLogSchema);

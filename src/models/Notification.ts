import mongoose, { Schema, Document } from 'mongoose';

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  type: 'test' | 'battle_challenge' | 'battle_result' | 'battle_accepted' | 'system' | 'welcome' | 'song_approved' | 'song_rejected' | 'song_in_progress' | 'comment_like';
  title: string;
  message: string;
  avatar?: string;
  read: boolean;
  data?: {
    battleId?: string;
    url?: string;
  };
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>({
  userId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true
  },
  type: { 
    type: String, 
    required: true,
    enum: ['test', 'battle_challenge', 'battle_result', 'battle_accepted', 'system', 'welcome', 'song_approved', 'song_rejected', 'song_in_progress', 'comment_like']
  },
  title: { 
    type: String, 
    required: true 
  },
  message: { 
    type: String, 
    required: true 
  },
  avatar: String,
  read: { 
    type: Boolean, 
    default: false 
  },
  data: {
    battleId: String,
    url: String
  }
}, {
  timestamps: true
});

// Index for fetching user's notifications
NotificationSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.models.Notification || mongoose.model<INotification>('Notification', NotificationSchema);

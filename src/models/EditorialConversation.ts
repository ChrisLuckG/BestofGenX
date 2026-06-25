import mongoose, { Schema, Document } from 'mongoose';

export interface IConversationMessage {
  role: 'user' | 'reporter';
  reporterId?: string;
  reporterName?: string;
  content: string;
  articleDraftId?: string;
  timestamp: Date;
}

export interface IEditorialConversation extends Document {
  reporterId: mongoose.Types.ObjectId;
  type: 'direct' | 'meeting';
  participantIds: mongoose.Types.ObjectId[];
  title: string;
  messages: IConversationMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IConversationMessage>(
  {
    role: { type: String, enum: ['user', 'reporter'], required: true },
    reporterId: { type: String, default: null },
    reporterName: { type: String, default: null },
    content: { type: String, required: true },
    articleDraftId: { type: String, default: null },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const EditorialConversationSchema = new Schema<IEditorialConversation>(
  {
    reporterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['direct', 'meeting'], default: 'direct' },
    participantIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    title: { type: String, default: 'New Conversation' },
    messages: { type: [MessageSchema], default: [] },
  },
  { timestamps: true }
);

EditorialConversationSchema.index({ reporterId: 1, updatedAt: -1 });

export default mongoose.models.EditorialConversation ||
  mongoose.model<IEditorialConversation>('EditorialConversation', EditorialConversationSchema);

import mongoose, { Schema, Document } from 'mongoose';

export interface IChatMessage {
  role: 'user' | 'mike';
  content: string;
  timestamp: Date;
}

export interface IMikeTask extends Document {
  title: string;
  description: string;
  originalRequest: string;
  chatHistory: string;
  chatMessages: IChatMessage[]; // NEW: Structured chat per ticket
  category: string;
  priority: string;
  status: string;
  complexity: string;
  notes: string;
  aiSuggestions: string;
  relatedPromptSection: string;
  attachments: string[]; // Base64 images from chat
  estimatedCost: number; // In EUR
  estimatedHours: number;
  actualCost?: number;
  cascadeNotes?: string; // Feedback from Cascade after completion
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MikeTaskSchema = new Schema<IMikeTask>({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  originalRequest: { type: String, default: '' },
  chatHistory: { type: String, default: '' },
  category: { 
    type: String, 
    enum: [
      // App Areas
      'Feed/Welcome Reel', 'Arcade', 'Shop', 'Rankings', 'Articles', 'Battles', 'Trivia', 'Predictions', 'TV', 'Radio', 'Profile',
      // Technical
      'UI/UX', 'Bug Fix', 'Mobile', 'Desktop', 'Backend', 'Frontend', 'Payments', 'Gamification', 'Content', 'Admin', 'AI', 'System Prompt', 'Future Features'
    ],
    default: 'Frontend'
  },
  priority: { 
    type: String, 
    enum: ['Critical', 'High', 'Medium', 'Low', 'Future Idea'],
    default: 'Medium'
  },
  status: { 
    type: String, 
    enum: ['Draft', 'Ready for Review', 'Approved', 'Backlog', 'In Progress', 'Waiting for Budget', 'Testing', 'Completed', 'Rejected'],
    default: 'Draft'
  },
  complexity: { 
    type: String, 
    enum: ['Trivial', 'Simple', 'Medium', 'Complex', 'Epic'],
    default: 'Medium'
  },
  notes: { type: String, default: '' },
  aiSuggestions: { type: String, default: '' },
  relatedPromptSection: { type: String, default: '' },
  attachments: { type: [String], default: [] },
  chatMessages: { 
    type: [{
      role: { type: String, enum: ['user', 'mike'], required: true },
      content: { type: String, required: true },
      timestamp: { type: Date, default: Date.now }
    }], 
    default: [] 
  },
  estimatedCost: { type: Number, default: 0 },
  estimatedHours: { type: Number, default: 0 },
  actualCost: { type: Number },
  cascadeNotes: { type: String },
  completedAt: { type: Date },
}, { timestamps: true });

export default mongoose.models.MikeTask || mongoose.model<IMikeTask>('MikeTask', MikeTaskSchema);

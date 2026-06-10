import mongoose, { Schema, Document } from 'mongoose';

export interface ITVVideo extends Document {
  title: string;
  description: string;
  youtubeUrl: string;
  youtubeId: string;
  thumbnail: string;
  category: string;
  duration: string;
  language: 'de' | 'en';
  featured: boolean;
  featuredPosition?: number; // 1, 2, or 3 for hero carousel
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TVVideoSchema = new Schema<ITVVideo>(
  {
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: '',
    },
    youtubeUrl: {
      type: String,
      required: true,
    },
    youtubeId: {
      type: String,
      required: true,
    },
    thumbnail: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      default: 'Music Videos',
    },
    duration: {
      type: String,
      default: '',
    },
    language: {
      type: String,
      enum: ['de', 'en'],
      default: 'en',
    },
    featured: {
      type: Boolean,
      default: false,
    },
    featuredPosition: {
      type: Number,
      default: null,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.TVVideo || mongoose.model<ITVVideo>('TVVideo', TVVideoSchema);

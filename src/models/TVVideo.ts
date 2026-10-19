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
  featuredPosition?: number; // 1, 2, or 3 for hero carousel (set by hand in the admin)
  widgetPosition?: number;
  homeCategory?: string; // where the video goes when it leaves "Todays Bogxers" (lib/personTvVideo.ts)
  todayAt?: Date; // when it entered "Todays Bogxers" - the newest 8 stay there
  categoryAt?: Date; // when it arrived in its current row - rows show the newest arrival first // 1, 2, or 3 in the GenX TV sidebar widget - the article videos' waterfall (lib/personTvVideo.ts)
  active: boolean;
  personRef?: mongoose.Types.ObjectId; // Link to Person from Menschen tab
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
    widgetPosition: {
      type: Number,
      default: null,
    },
    homeCategory: {
      type: String,
      default: null,
    },
    todayAt: {
      type: Date,
      default: null,
    },
    categoryAt: {
      type: Date,
      default: null,
    },
    active: {
      type: Boolean,
      default: true,
    },
    personRef: {
      type: Schema.Types.ObjectId,
      ref: 'Person',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.TVVideo || mongoose.model<ITVVideo>('TVVideo', TVVideoSchema);

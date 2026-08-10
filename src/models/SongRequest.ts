import mongoose, { Schema, Document } from 'mongoose';

export interface ISongRequest extends Document {
  userId?: mongoose.Types.ObjectId;
  username: string;
  playlist: string; // e.g. "Techno", "HipHop"
  band: string;
  song: string;
  link?: string; // Optional Spotify/YouTube link
  coverImage?: string; // Album cover from Spotify
  status: 'new' | 'in_progress' | 'added' | 'rejected';
  votes: number;
  votedBy: string[];
  createdAt: Date;
  updatedAt: Date;
}

const SongRequestSchema = new Schema<ISongRequest>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    username: {
      type: String,
      required: true,
    },
    playlist: {
      type: String,
      required: true,
    },
    band: {
      type: String,
      required: true,
    },
    song: {
      type: String,
      required: true,
    },
    link: {
      type: String,
      default: null,
    },
    coverImage: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ['new', 'in_progress', 'added', 'rejected'],
      default: 'new',
    },
    votes: {
      type: Number,
      default: 0,
    },
    votedBy: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

export default (mongoose.models.SongRequest as mongoose.Model<ISongRequest>) ||
  mongoose.model<ISongRequest>('SongRequest', SongRequestSchema);

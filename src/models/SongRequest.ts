import mongoose, { Schema, Document } from 'mongoose';

export interface ISongRequest extends Document {
  userId?: mongoose.Types.ObjectId;
  username: string;
  playlist: string; // e.g. "Techno", "HipHop"
  band: string;
  song: string;
  link?: string; // Optional Spotify/YouTube link
  status: 'new' | 'in_progress' | 'added' | 'rejected';
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
    status: {
      type: String,
      enum: ['new', 'in_progress', 'added', 'rejected'],
      default: 'new',
    },
  },
  { timestamps: true }
);

export default (mongoose.models.SongRequest as mongoose.Model<ISongRequest>) ||
  mongoose.model<ISongRequest>('SongRequest', SongRequestSchema);

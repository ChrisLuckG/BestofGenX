import mongoose, { Schema, Document } from 'mongoose';

export interface ISpotifyToken extends Document {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SpotifyTokenSchema = new Schema<ISpotifyToken>(
  {
    accessToken: { type: String, required: true },
    refreshToken: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

export default mongoose.models.SpotifyToken || mongoose.model<ISpotifyToken>('SpotifyToken', SpotifyTokenSchema);

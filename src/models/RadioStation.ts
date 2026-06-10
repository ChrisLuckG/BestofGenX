import mongoose, { Schema, Document } from 'mongoose';

export interface IRadioStation extends Document {
  name: string;
  description: string;
  playlistId: string; // Spotify playlist ID
  imageUrl?: string; // Spotify playlist cover image
  order: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const RadioStationSchema = new Schema<IRadioStation>(
  {
    name: { type: String, required: true },
    description: { type: String, default: '' },
    playlistId: { type: String, required: true },
    imageUrl: { type: String, default: '' },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.models.RadioStation || mongoose.model<IRadioStation>('RadioStation', RadioStationSchema);

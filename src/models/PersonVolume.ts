import mongoose from 'mongoose';

/**
 * One "Goes to 11" vote per user and person (lib/personVolume.ts). The document stays when the user
 * changes the vote, so `rewarded` persists and the one-time BOGX reward can never be collected twice.
 */
const PersonVolumeSchema = new mongoose.Schema({
  personId: { type: mongoose.Schema.Types.ObjectId, ref: 'Person', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  value: { type: Number, required: true, min: 1, max: 11 },
  rewarded: { type: Boolean, default: false },
}, { timestamps: true });

PersonVolumeSchema.index({ personId: 1, userId: 1 }, { unique: true });

const PersonVolume = mongoose.models.PersonVolume || mongoose.model('PersonVolume', PersonVolumeSchema);

export default PersonVolume;

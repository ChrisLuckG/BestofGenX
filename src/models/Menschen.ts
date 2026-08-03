import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IMensch extends Document {
  // Basic info
  name: string;
  birthday: string; // DD.MM.YYYY format
  deathday?: string; // DD.MM.YYYY format (for RIP)
  causeOfDeath?: string;
  country: string;
  countryCode?: string; // ISO country code for flag
  
  // Classification
  category: string; // sports, music, movies-tv, politics, gaming, lifestyle, culture
  profession?: string;
  isGenX: boolean; // born 1965-1980
  birthYear?: number;
  
  // Description & content
  description: string;
  shortBio?: string;
  
  // Media
  imageUrl?: string;
  wikiUrl?: string;
  
  // Discovery metadata
  discoveredBy: string; // Reporter userId who found them
  discoveredByName: string; // Reporter name
  discoveredAt: Date;
  discoveredFor: 'birthday' | 'rip'; // What type of search found them
  
  // Article tracking
  hasArticle: boolean;
  articleId?: mongoose.Types.ObjectId;
  articleCreatedAt?: Date;
  articleCreatedBy?: string; // userId of editor who approved
  
  // Status
  isVerified: boolean; // Manually verified as correct
  isRejected: boolean; // Marked as incorrect/invalid
  rejectionReason?: string;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const MenschSchema = new Schema<IMensch>({
  // Basic info
  name: { type: String, required: true, index: true },
  birthday: { type: String, required: true },
  deathday: { type: String },
  causeOfDeath: { type: String },
  country: { type: String, required: true },
  countryCode: { type: String },
  
  // Classification
  category: { 
    type: String, 
    enum: ['sports', 'music', 'movies-tv', 'politics', 'gaming', 'lifestyle', 'culture', 'authors', 'unknown'],
    default: 'unknown'
  },
  profession: { type: String },
  isGenX: { type: Boolean, default: true },
  birthYear: { type: Number },
  
  // Description & content
  description: { type: String, required: true },
  shortBio: { type: String },
  
  // Media
  imageUrl: { type: String },
  wikiUrl: { type: String },
  
  // Discovery metadata
  discoveredBy: { type: String, required: true },
  discoveredByName: { type: String, required: true },
  discoveredAt: { type: Date, default: Date.now },
  discoveredFor: { type: String, enum: ['birthday', 'rip'], required: true },
  
  // Article tracking
  hasArticle: { type: Boolean, default: false },
  articleId: { type: Schema.Types.ObjectId, ref: 'Article' },
  articleCreatedAt: { type: Date },
  articleCreatedBy: { type: String },
  
  // Status
  isVerified: { type: Boolean, default: false },
  isRejected: { type: Boolean, default: false },
  rejectionReason: { type: String },
}, {
  timestamps: true,
});

// Compound index for finding duplicates
MenschSchema.index({ name: 1, birthday: 1 }, { unique: true });

// Index for birthday searches (day.month)
MenschSchema.index({ birthday: 1 });

// Index for deathday searches
MenschSchema.index({ deathday: 1 });

// Index for category filtering
MenschSchema.index({ category: 1 });

// Index for article tracking
MenschSchema.index({ hasArticle: 1 });

const Menschen: Model<IMensch> = mongoose.models.Menschen || mongoose.model<IMensch>('Menschen', MenschSchema);

export default Menschen;

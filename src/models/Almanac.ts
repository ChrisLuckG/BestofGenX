import mongoose from 'mongoose';

// Shared social media schema
const SocialMediaSchema = new mongoose.Schema({
  twitter: String,
  instagram: String,
  youtube: String,
  linkedin: String,
  tiktok: String,
  facebook: String,
  website: String,
}, { _id: false });

// Person (Best of GenX) - UNIFIED model (replaces old Menschen model)
export interface IPerson {
  _id?: string;
  // Name fields
  firstname: string;
  lastname: string;
  
  // Dates (YYYY-MM-DD format)
  born?: string;
  died?: string;
  causeOfDeath?: string;
  
  // Classification
  profession: string; // Music, Actor, Sport, Politik, Art, Tech, Comedy, Model, Other
  subcat?: string; // More specific: "Rock Singer", "Boxer", etc.
  category?: string; // sports, music, movies-tv, politics, gaming, lifestyle, culture
  
  // Description
  knownfor?: string;
  description?: string;
  shortBio?: string;
  
  // Location
  countryBorn?: string;
  cityBorn?: string;
  countryDied?: string;
  cityDied?: string;
  nationality?: string;
  countryCode?: string; // ISO code for flag
  
  // Family
  parents?: string;
  siblings?: number;
  
  // Media
  image?: string;
  wikiUrl?: string;
  
  // Social media
  social?: {
    twitter?: string;
    instagram?: string;
    youtube?: string;
    linkedin?: string;
    tiktok?: string;
    facebook?: string;
    website?: string;
  };
  
  // Saved news clippings
  savedNews?: {
    headline: string;
    body: string;
    source: string;
    category: string;
    savedAt: string;
  }[];
  
  // GenX status
  isGenX?: boolean; // born 1965-1980
  birthYear?: number;
  
  // Article tracking
  hasArticle?: boolean;
  articleId?: string;
  articleCreatedAt?: Date;
  articleCreatedBy?: string;
  
  // Discovery tracking (from Editorial Conference)
  discoveredBy?: string;
  discoveredByName?: string;
  discoveredFor?: 'birthday' | 'rip';
  discoveredAt?: Date;
  
  // Videos (documentaries, interviews, etc.)
  videos?: {
    videoId: string;
    title: string;
    duration?: string; // e.g. "45:32"
    type?: 'documentary' | 'interview' | 'performance' | 'other';
  }[];
  featuredVideoIndex?: number; // Which video to show on Welcome Reel (0, 1, or 2)
  
  // Verification status
  isVerified?: boolean;
  isRejected?: boolean;
  rejectionReason?: string;
  
  // Timestamps
  createdAt?: Date;
  updatedAt?: Date;
}

const PersonSchema = new mongoose.Schema({
  // Name
  firstname: { type: String, required: true, index: true },
  lastname: { type: String, required: true, index: true },
  
  // Dates (YYYY-MM-DD format)
  born: { type: String, index: true },
  died: String,
  causeOfDeath: String,
  
  // Classification
  profession: { type: String, required: true, enum: ['Music', 'Actor', 'Sport', 'Politik', 'Art', 'Tech', 'Comedy', 'Model', 'Other'] },
  subcat: String,
  category: { type: String, enum: ['sports', 'music', 'movies-tv', 'politics', 'gaming', 'lifestyle', 'culture', 'authors', 'unknown'] },
  
  // Description
  knownfor: String,
  description: String,
  shortBio: String,
  
  // Location
  countryBorn: String,
  cityBorn: String,
  countryDied: String,
  cityDied: String,
  nationality: String,
  countryCode: String,
  
  // Family
  parents: String,
  siblings: Number,
  
  // Media
  image: String,
  wikiUrl: String,
  
  // Social media
  social: SocialMediaSchema,
  
  // Saved news
  savedNews: [{
    headline: String,
    body: String,
    source: String,
    category: String,
    savedAt: String,
  }],
  
  // GenX status
  isGenX: { type: Boolean, default: true },
  birthYear: Number,
  
  // Article tracking
  hasArticle: { type: Boolean, default: false, index: true },
  articleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Article' },
  articleCreatedAt: Date,
  articleCreatedBy: String,
  
  // Discovery tracking (from Editorial Conference)
  discoveredBy: String,
  discoveredByName: String,
  discoveredFor: { type: String, enum: ['birthday', 'rip'] },
  discoveredAt: { type: Date, default: Date.now },
  
  // Videos (documentaries, interviews, etc.)
  videos: [{
    videoId: String,
    title: String,
    duration: String,
    type: { type: String, enum: ['documentary', 'interview', 'performance', 'other'] },
  }],
  featuredVideoIndex: { type: Number, default: 0 },
  
  // Verification status
  isVerified: { type: Boolean, default: false },
  isRejected: { type: Boolean, default: false },
  rejectionReason: String,
}, { timestamps: true });

// Compound index for finding duplicates
PersonSchema.index({ firstname: 1, lastname: 1 }, { unique: true });

// Generic item for other categories
export interface IAlmanacItem {
  _id?: string;
  category: 'games' | 'movies' | 'bands' | 'albums' | 'tvseries' | 'food' | 'cars' | 'fashion' | 'gadgets' | 'toys' | 'slang';
  rank?: number;
  image?: string;
  data: Record<string, any>; // Flexible data based on category
}

const AlmanacItemSchema = new mongoose.Schema({
  category: { 
    type: String, 
    required: true, 
    enum: ['games', 'movies', 'bands', 'albums', 'tvseries', 'food', 'cars', 'fashion', 'gadgets', 'toys', 'slang'],
    index: true,
  },
  rank: Number,
  image: String,
  data: { type: mongoose.Schema.Types.Mixed, required: true },
}, { timestamps: true });

// Delete cached models
if (mongoose.models.Person) delete mongoose.models.Person;
if (mongoose.models.AlmanacItem) delete mongoose.models.AlmanacItem;

export const Person = mongoose.model<IPerson>('Person', PersonSchema);
export const AlmanacItem = mongoose.model<IAlmanacItem>('AlmanacItem', AlmanacItemSchema);

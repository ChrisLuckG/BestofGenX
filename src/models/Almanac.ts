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

// Person (Best of GenX)
export interface IPerson {
  _id?: string;
  firstname: string;
  lastname: string;
  born?: string;
  died?: string;
  causeOfDeath?: string;
  profession: string;
  subcat?: string;
  knownfor?: string;
  countryBorn?: string;
  cityBorn?: string;
  countryDied?: string;
  nationality?: string;
  parents?: string;
  siblings?: number;
  image?: string;
  social?: {
    twitter?: string;
    instagram?: string;
    youtube?: string;
    linkedin?: string;
    tiktok?: string;
    facebook?: string;
    website?: string;
  };
  savedNews?: {
    headline: string;
    body: string;
    source: string;
    category: string;
    savedAt: string;
  }[];
  // Article tracking
  hasArticle?: boolean;
  articleId?: string;
  articleCreatedAt?: Date;
  // Discovery tracking
  discoveredBy?: string;
  discoveredByName?: string;
  discoveredFor?: 'birthday' | 'rip';
}

const PersonSchema = new mongoose.Schema({
  firstname: { type: String, required: true },
  lastname: { type: String, required: true },
  born: String,
  died: String,
  causeOfDeath: String,
  profession: { type: String, required: true, enum: ['Music', 'Actor', 'Sport', 'Politik', 'Art', 'Tech', 'Comedy', 'Model', 'Other'] },
  subcat: String,
  knownfor: String,
  countryBorn: String,
  cityBorn: String,
  countryDied: String,
  nationality: String,
  parents: String,
  siblings: Number,
  image: String,
  social: SocialMediaSchema,
  savedNews: [{
    headline: String,
    body: String,
    source: String,
    category: String,
    savedAt: String,
  }],
  // Article tracking
  hasArticle: { type: Boolean, default: false },
  articleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Article' },
  articleCreatedAt: Date,
  // Discovery tracking (from Editorial Conference)
  discoveredBy: String,
  discoveredByName: String,
  discoveredFor: { type: String, enum: ['birthday', 'rip'] },
}, { timestamps: true });

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

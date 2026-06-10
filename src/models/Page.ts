import mongoose from 'mongoose';

export interface IPage {
  _id?: string;
  slug: string; // URL slug: 'about', 'impressum', 'datenschutz', 'agb', 'kontakt', 'presse', 'karriere'
  title: string;
  subtitle?: string;
  content: string; // HTML content
  coverImage?: string;
  status: 'draft' | 'published';
  order: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const PageSchema = new mongoose.Schema({
  slug: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
  },
  subtitle: {
    type: String,
    trim: true,
    maxlength: 300,
  },
  content: {
    type: String,
    required: true,
  },
  coverImage: {
    type: String,
    default: '',
  },
  status: {
    type: String,
    enum: ['draft', 'published'],
    default: 'draft',
  },
  order: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

export default mongoose.models.Page || mongoose.model<IPage>('Page', PageSchema);

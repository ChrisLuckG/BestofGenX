import mongoose, { Schema, Document } from 'mongoose';

export type ReporterRole =
  | 'journalist' | 'editor' | 'copy-editor' | 'fact-checker'
  | 'ceo' | 'cmo' | 'cpo' | 'coo' | 'strategist'
  | 'developer' | 'cto' | 'product-owner' | 'project-manager'
  | 'art-director' | 'designer' | 'social-media-manager'
  | 'secretary' | 'office-manager' | 'hr-manager' | 'analyst';

export const REPORTER_ROLES: { value: ReporterRole; label: string; group: string }[] = [
  { value: 'journalist', label: 'Journalist', group: 'Editorial' },
  { value: 'editor', label: 'Editor', group: 'Editorial' },
  { value: 'copy-editor', label: 'Copy Editor', group: 'Editorial' },
  { value: 'fact-checker', label: 'Fact Checker', group: 'Editorial' },
  { value: 'ceo', label: 'CEO', group: 'Strategy' },
  { value: 'cmo', label: 'CMO', group: 'Strategy' },
  { value: 'cpo', label: 'CPO', group: 'Strategy' },
  { value: 'coo', label: 'COO', group: 'Strategy' },
  { value: 'strategist', label: 'Strategist', group: 'Strategy' },
  { value: 'developer', label: 'Developer', group: 'Technical' },
  { value: 'cto', label: 'CTO', group: 'Technical' },
  { value: 'product-owner', label: 'Product Owner', group: 'Technical' },
  { value: 'project-manager', label: 'Project Manager', group: 'Technical' },
  { value: 'art-director', label: 'Art Director', group: 'Creative' },
  { value: 'designer', label: 'Designer', group: 'Creative' },
  { value: 'social-media-manager', label: 'Social Media Manager', group: 'Creative' },
  { value: 'secretary', label: 'Secretary', group: 'Operations' },
  { value: 'office-manager', label: 'Office Manager', group: 'Operations' },
  { value: 'hr-manager', label: 'HR Manager', group: 'Operations' },
  { value: 'analyst', label: 'Analyst', group: 'Operations' },
];

export type ReporterRegion = 
  | 'north-america' | 'south-america' | 'europe' | 'united-kingdom' | 'asia' 
  | 'oceania' | 'africa' | 'middle-east' | 'global';

export const REPORTER_REGIONS: { value: ReporterRegion; label: string }[] = [
  { value: 'north-america', label: 'North America' },
  { value: 'south-america', label: 'South America' },
  { value: 'united-kingdom', label: 'United Kingdom' },
  { value: 'europe', label: 'Europe' },
  { value: 'asia', label: 'Asia' },
  { value: 'oceania', label: 'Oceania' },
  { value: 'africa', label: 'Africa' },
  { value: 'middle-east', label: 'Middle East' },
  { value: 'global', label: 'Global' },
];

export interface IReporterProfile extends Document {
  userId: mongoose.Types.ObjectId;
  slug: string;
  role: ReporterRole;
  region?: ReporterRegion;
  nationality: string;
  countryFlag?: string;
  countryCode?: string;
  specialty?: string;
  politicalTendency?: string;
  responsibilities: string;
  writingStyle?: string;
  personality?: string;
  systemPrompt: string;
  memories: string[];
  articleCount: number;
  lastActive?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ReporterProfileSchema = new Schema<IReporterProfile>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    slug: { type: String, required: true, unique: true },
    role: { type: String, required: true, default: 'journalist' },
    region: { type: String, enum: ['north-america', 'south-america', 'united-kingdom', 'europe', 'asia', 'oceania', 'africa', 'middle-east', 'global'], default: 'global' },
    nationality: { type: String, default: '' },
    countryFlag: { type: String, default: '' },
    countryCode: { type: String, default: '' },
    specialty: { type: String, default: '' },
    politicalTendency: { type: String, default: '' },
    responsibilities: { type: String, default: '' },
    writingStyle: { type: String, default: '' },
    personality: { type: String, default: '' },
    systemPrompt: { type: String, required: true },
    memories: { type: [String], default: [] },
    articleCount: { type: Number, default: 0 },
    lastActive: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.models.ReporterProfile ||
  mongoose.model<IReporterProfile>('ReporterProfile', ReporterProfileSchema);

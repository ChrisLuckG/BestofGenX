import mongoose from 'mongoose';

// Dynamically-created categories. The static list in src/lib/categories.ts
// (History, Sport, Music, TV & Cinema, ...) covers the broad verticals picked
// up front, but an admin needs to be able to type any subject into a container
// name - "EisHockey", "Fussball", "Padel" - and have it become a real,
// pickable category. This collection holds exactly those: the ones NOT already
// in the static CATEGORIES array.
//
// getAutoFillSlugs() in lib/categories.ts already matches articles to a
// container by slugified name without needing this collection. This exists so
// the category also shows up as an OPTION in the admin dropdowns (article
// form, Post Manager row, the block editor's autoFillCategory select) - a
// slug that only auto-fills but cannot be assigned to an article is useless.
//
// Kept deliberately thin: no `keywords` regex and no `aliases`. Those two only
// make sense for the hand-curated static entries; a dynamic category matches
// on its slug alone.

export interface ICategory {
  slug: string;
  label: string;
  color: string;
  createdAt?: Date;
}

const CategorySchema = new mongoose.Schema<ICategory>({
  // lowercase+trim here is a safety net only - callers must pass a value from
  // slugify() in lib/categories.ts, which also transliterates umlauts. Relying
  // on Mongoose's lowercase alone would let "Fußball" through as "fußball"
  // while the container resolves to "fussball", and the two would never meet.
  slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
  label: { type: String, required: true, trim: true },
  color: { type: String, default: '#6b7280' },
}, {
  timestamps: true,
});

// Next.js dev server hot-reloads this module; without dropping the cached
// model first, Mongoose throws OverwriteModelError. Same pattern as the other
// models in this folder.
if (mongoose.models.Category) {
  delete mongoose.models.Category;
}

export default mongoose.model<ICategory>('Category', CategorySchema);

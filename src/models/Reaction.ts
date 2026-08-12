import mongoose from 'mongoose';

/**
 * Single source of truth for article reactions (mood emojis).
 *
 * WHY THIS FILE EXISTS:
 * This schema used to be declared inline in BOTH /api/articles/route.ts and
 * /api/articles/react/route.ts. Because both used
 * `mongoose.models.Reaction || mongoose.model('Reaction', ...)`, whichever
 * route was imported first won - and the copy in /api/articles/route.ts was
 * missing the `rewarded` field and declared `emojiId` as required. When that
 * copy won the race:
 *   - `rewarded` was silently stripped on save, so `!reaction.rewarded` was
 *     always true and 0.01 BOGX was paid out on EVERY click (coin farming).
 *   - `emojiId: required` made toggling a reaction off (emojiId = null) fail
 *     validation, so counts and displayed icons went out of sync.
 * Keep exactly one copy.
 *
 * The document is kept even after the user removes their reaction
 * (emojiId: null) so the `rewarded` flag persists and coins can never be
 * farmed by re-liking. `rewarded` defaults to true so pre-existing reactions
 * (which were already paid out on creation) don't hand out a second reward.
 */
const ReactionSchema = new mongoose.Schema({
  articleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Article', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  emojiId: { type: String, default: null },
  rewarded: { type: Boolean, default: true },
}, { timestamps: true });

ReactionSchema.index({ articleId: 1, userId: 1 }, { unique: true });

const Reaction = mongoose.models.Reaction || mongoose.model('Reaction', ReactionSchema);

export default Reaction;

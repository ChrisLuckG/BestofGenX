import mongoose, { Schema } from 'mongoose';
import type { RunPhase, SlotKind } from '@/lib/dailyAutoSchedule';

// Daily Auto: ONE config document (the schedule + on/off switches) and ONE run
// document per slot per Berlin calendar day.

export interface IDailyAutoConfig {
  key: string;
  /** Master switch for the whole automation. Off = nothing is generated or published. */
  masterEnabled: boolean;
  slots: { id: string; kind: SlotKind; start: string; enabled: boolean }[];
}

const DailyAutoConfigSchema = new Schema<IDailyAutoConfig>(
  {
    key: { type: String, required: true, unique: true, default: 'default' },
    // Defaults to ON: Winners and History used to run from their own crons, which the
    // hourly tick replaces - a missing field must not silently stop them.
    masterEnabled: { type: Boolean, default: true },
    slots: [
      {
        _id: false,
        id: { type: String, required: true },
        kind: { type: String, required: true, enum: ['bogx', 'bogx-rankroll', 'winners', 'history', 'radio', 'rip'] },
        start: { type: String, required: true },
        enabled: { type: Boolean, default: false },
      },
    ],
  },
  { timestamps: true },
);

export interface IDailyAutoRun {
  dayKey: string;
  slotId: string;
  phase: RunPhase;
  claimedAt?: Date;
  articleId?: string;
  pollId?: string;
  personName?: string;
  message?: string;
}

const DailyAutoRunSchema = new Schema<IDailyAutoRun>(
  {
    dayKey: { type: String, required: true },
    slotId: { type: String, required: true },
    phase: { type: String, required: true, enum: ['generating', 'ready', 'published', 'error'] },
    claimedAt: Date,
    articleId: String,
    pollId: String,
    personName: String,
    message: String,
  },
  { timestamps: true },
);
// The unique index IS the lock: two overlapping cron ticks cannot both claim a slot.
DailyAutoRunSchema.index({ dayKey: 1, slotId: 1 }, { unique: true });

export const DailyAutoConfig =
  (mongoose.models.DailyAutoConfig as mongoose.Model<IDailyAutoConfig>) ||
  mongoose.model<IDailyAutoConfig>('DailyAutoConfig', DailyAutoConfigSchema);

export const DailyAutoRun =
  (mongoose.models.DailyAutoRun as mongoose.Model<IDailyAutoRun>) ||
  mongoose.model<IDailyAutoRun>('DailyAutoRun', DailyAutoRunSchema);

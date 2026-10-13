import mongoose, { Schema, Document } from 'mongoose';

// One row per PAID Stripe donation session. stripeSessionId is unique, so the webhook
// and the return-page verification can both record the same payment without ever
// counting it twice.
export interface IDonation extends Document {
  stripeSessionId: string;
  amountCents: number;
  currency: string;
  /** false for test-mode payments - those never count towards the live war chest */
  livemode: boolean;
  userId?: string;
  email?: string;
  paidAt: Date;
}

const DonationSchema = new Schema<IDonation>({
  stripeSessionId: { type: String, required: true, unique: true },
  amountCents: { type: Number, required: true, min: 1 },
  currency: { type: String, default: 'eur' },
  livemode: { type: Boolean, required: true, default: false },
  userId: { type: String },
  email: { type: String },
  paidAt: { type: Date, default: Date.now },
}, { timestamps: true });

export default mongoose.models.Donation || mongoose.model<IDonation>('Donation', DonationSchema);

import mongoose, { Schema, Document } from 'mongoose';

export interface ITVCategory extends Document {
  name: string;
  order: number;
  active: boolean;
  createdAt: Date;
}

const TVCategorySchema = new Schema<ITVCategory>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    order: {
      type: Number,
      default: 0,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.TVCategory || mongoose.model<ITVCategory>('TVCategory', TVCategorySchema);

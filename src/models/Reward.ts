import mongoose from 'mongoose';

const RewardSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  longDescription: {
    type: String,
    default: '',
  },
  cost: {
    type: Number,
    required: true,
  },
  partner: {
    type: String,
    default: 'SportTock',
  },
  icon: {
    type: String,
    default: 'Gift', // Lucide icon name
  },
  category: {
    type: String,
    enum: ['premium', 'standard', 'starter'],
    default: 'standard',
  },
  image: {
    type: String,
    default: '', // URL to reward image
  },
  howToRedeem: {
    type: String,
    default: '',
  },
  terms: {
    type: String,
    default: '',
  },
  active: {
    type: Boolean,
    default: true,
  },
  stock: {
    type: Number,
    default: -1, // -1 = unlimited
  },
  // Shop integration - if set, this reward is linked to a shop product
  shopProductId: {
    type: String,
    default: '', // Printify product ID
  },
  shopVariantId: {
    type: String,
    default: '', // Printify variant ID (size/color)
  },
  requiresShipping: {
    type: Boolean,
    default: false, // If true, user needs to enter shipping address
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.models.Reward || mongoose.model('Reward', RewardSchema);

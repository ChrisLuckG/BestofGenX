import mongoose, { Schema, Document } from 'mongoose';

export interface IOrderItem {
  productId: string;
  productName: string;
  variantId: number;
  variantTitle: string;
  quantity: number;
  price: number;
  image?: string;
}

export interface IOrder extends Document {
  oderId: string; // Our internal order ID
  stripeSessionId: string;
  stripePaymentIntentId?: string;
  printfulOrderId?: string;
  userId?: string;
  customerEmail: string;
  customerName?: string;
  items: IOrderItem[];
  subtotal: number;
  shipping: number;
  total: number;
  currency: string;
  status: 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
  shippingAddress?: {
    name: string;
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    postalCode: string;
    country: string;
  };
  trackingNumber?: string;
  trackingUrl?: string;
  paymentMethod: 'stripe' | 'points';
  pointsUsed?: number;
  createdAt: Date;
  updatedAt: Date;
  paidAt?: Date;
  shippedAt?: Date;
  deliveredAt?: Date;
}

const OrderItemSchema = new Schema({
  productId: { type: String, required: true },
  productName: { type: String, required: true },
  variantId: { type: Number, required: true },
  variantTitle: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true },
  image: { type: String },
});

const OrderSchema = new Schema<IOrder>({
  oderId: { type: String, required: true, unique: true },
  stripeSessionId: { type: String, required: true, unique: true },
  stripePaymentIntentId: { type: String },
  printfulOrderId: { type: String },
  userId: { type: String, index: true },
  customerEmail: { type: String, required: true },
  customerName: { type: String },
  items: [OrderItemSchema],
  subtotal: { type: Number, required: true },
  shipping: { type: Number, default: 0 },
  total: { type: Number, required: true },
  currency: { type: String, default: 'EUR' },
  status: { 
    type: String, 
    enum: ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'],
    default: 'pending'
  },
  shippingAddress: {
    name: { type: String },
    line1: { type: String },
    line2: { type: String },
    city: { type: String },
    state: { type: String },
    postalCode: { type: String },
    country: { type: String },
  },
  trackingNumber: { type: String },
  trackingUrl: { type: String },
  paymentMethod: { type: String, enum: ['stripe', 'points'], default: 'stripe' },
  pointsUsed: { type: Number },
  paidAt: { type: Date },
  shippedAt: { type: Date },
  deliveredAt: { type: Date },
}, {
  timestamps: true,
});

// Helper to generate unique order ID
export function generateOrderId(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `BOGX-${timestamp}-${random}`;
}

export default mongoose.models.Order || mongoose.model<IOrder>('Order', OrderSchema);

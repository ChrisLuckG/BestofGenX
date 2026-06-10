import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import dbConnect from '@/lib/mongoose';
import Order, { generateOrderId } from '@/models/Order';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

const PRINTFUL_API_TOKEN = process.env.PRINTFUL_API_TOKEN;
const PRINTFUL_API_URL = 'https://api.printful.com';

// Create order in Printful
async function createPrintfulOrder(order: any, shippingAddress: any) {
  if (!PRINTFUL_API_TOKEN) {
    console.error('Printful API token not configured');
    return null;
  }

  try {
    // Build Printful order items
    const items = order.items.map((item: any) => ({
      sync_variant_id: item.variantId,
      quantity: item.quantity,
    }));

    const printfulOrder = {
      recipient: {
        name: shippingAddress.name,
        address1: shippingAddress.line1,
        address2: shippingAddress.line2 || '',
        city: shippingAddress.city,
        state_code: shippingAddress.state || '',
        country_code: shippingAddress.country,
        zip: shippingAddress.postalCode,
        email: order.customerEmail,
      },
      items,
      retail_costs: {
        currency: 'EUR',
        subtotal: order.subtotal.toFixed(2),
        shipping: order.shipping.toFixed(2),
        total: order.total.toFixed(2),
      },
    };

    console.log('Creating Printful order:', JSON.stringify(printfulOrder, null, 2));

    const response = await fetch(`${PRINTFUL_API_URL}/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PRINTFUL_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(printfulOrder),
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('Printful order failed:', data);
      return null;
    }

    console.log('Printful order created:', data.result?.id);
    return data.result;
  } catch (error) {
    console.error('Printful order error:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json({ error: 'No signature' }, { status: 400 });
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    console.log('Stripe webhook received:', event.type);

    // Handle checkout.session.completed
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      
      await dbConnect();

      // Check if order already exists
      const existingOrder = await Order.findOne({ stripeSessionId: session.id });
      if (existingOrder) {
        console.log('Order already exists:', existingOrder.oderId);
        return NextResponse.json({ received: true, orderId: existingOrder.oderId });
      }

      // Parse metadata
      const metadata = session.metadata || {};
      const cartItems = metadata.cartItems ? JSON.parse(metadata.cartItems) : [];
      const userId = metadata.userId;

      // Get shipping address (use type assertion for shipping_details)
      const shippingDetails = (session as any).shipping_details;
      const shippingAddress = shippingDetails?.address ? {
        name: shippingDetails.name || '',
        line1: shippingDetails.address.line1 || '',
        line2: shippingDetails.address.line2 || '',
        city: shippingDetails.address.city || '',
        state: shippingDetails.address.state || '',
        postalCode: shippingDetails.address.postal_code || '',
        country: shippingDetails.address.country || '',
      } : undefined;

      // Create order in database
      const order = await Order.create({
        oderId: generateOrderId(),
        stripeSessionId: session.id,
        stripePaymentIntentId: session.payment_intent as string,
        userId,
        customerEmail: session.customer_details?.email || '',
        customerName: session.customer_details?.name || shippingDetails?.name || '',
        items: cartItems,
        subtotal: (session.amount_subtotal || 0) / 100,
        shipping: (session.shipping_cost?.amount_total || 0) / 100,
        total: (session.amount_total || 0) / 100,
        currency: session.currency?.toUpperCase() || 'EUR',
        status: 'paid',
        shippingAddress,
        paymentMethod: 'stripe',
        paidAt: new Date(),
      });

      console.log('Order created:', order.oderId);

      // Create Printful order
      if (shippingAddress && cartItems.length > 0) {
        const printfulResult = await createPrintfulOrder(order, shippingAddress);
        if (printfulResult) {
          order.printfulOrderId = printfulResult.id?.toString();
          order.status = 'processing';
          await order.save();
          console.log('Printful order linked:', printfulResult.id);
        }
      }

      return NextResponse.json({ 
        received: true, 
        orderId: order.oderId,
        printfulOrderId: order.printfulOrderId,
      });
    }

    // Handle other events
    if (event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      console.log('Payment failed:', paymentIntent.id);
      
      await dbConnect();
      await Order.findOneAndUpdate(
        { stripePaymentIntentId: paymentIntent.id },
        { status: 'cancelled' }
      );
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

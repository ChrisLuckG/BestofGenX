import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { Resend } from 'resend';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
const resend = new Resend(process.env.RESEND_API_KEY);

const PRINTFUL_API_TOKEN = process.env.PRINTFUL_API_TOKEN;
const PRINTFUL_API_URL = 'https://api.printful.com';

// Best of GenX Order Confirmation Email
function createOrderEmail(customerName: string, orderItems: string, totalAmount: string, shippingAddress: string) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #000000; font-family: Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #000000; padding: 40px 20px;">
    
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 40px;">
      <h1 style="color: #f20550; font-size: 32px; margin: 0;">Best of GenX</h1>
      <p style="color: #888888; font-size: 14px; margin-top: 8px;">Retro Vibes. Modern Style.</p>
    </div>
    
    <!-- Confirmation -->
    <div style="background: linear-gradient(135deg, rgba(242,5,80,0.2), rgba(128,0,255,0.2)); border: 1px solid rgba(242,5,80,0.3); border-radius: 16px; padding: 30px; text-align: center; margin-bottom: 30px;">
      <div style="font-size: 48px; margin-bottom: 16px;">🎉</div>
      <h2 style="color: #ffffff; font-size: 24px; margin: 0 0 8px 0;">Bestellung bestätigt!</h2>
      <p style="color: #cccccc; font-size: 16px; margin: 0;">Danke für deine Bestellung, ${customerName}!</p>
    </div>
    
    <!-- Order Details -->
    <div style="background-color: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 24px; margin-bottom: 20px;">
      <h3 style="color: #f20550; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 16px 0;">Deine Bestellung</h3>
      ${orderItems}
      <div style="border-top: 1px solid rgba(255,255,255,0.1); margin-top: 16px; padding-top: 16px;">
        <p style="color: #ffffff; font-size: 18px; font-weight: bold; margin: 0;">Gesamt: ${totalAmount}</p>
      </div>
    </div>
    
    <!-- Shipping Address -->
    <div style="background-color: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 24px; margin-bottom: 30px;">
      <h3 style="color: #f20550; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 16px 0;">Lieferadresse</h3>
      <p style="color: #cccccc; font-size: 14px; line-height: 1.6; margin: 0; white-space: pre-line;">${shippingAddress}</p>
    </div>
    
    <!-- Info -->
    <div style="text-align: center; padding: 20px;">
      <p style="color: #888888; font-size: 14px; line-height: 1.6; margin: 0 0 16px 0;">
        Deine Bestellung wird jetzt liebevoll für dich produziert. 
        Du erhältst eine weitere E-Mail mit Tracking-Infos sobald dein Paket unterwegs ist!
      </p>
      <p style="color: #f20550; font-size: 14px; margin: 0;">
        ✨ Welcome to the GenX Club! ✨
      </p>
    </div>
    
    <!-- Footer -->
    <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1);">
      <p style="color: #666666; font-size: 12px; margin: 0;">
        © 2026 Best of GenX | For the 80s, 90s & 2000s Generation
      </p>
    </div>
    
  </div>
</body>
</html>
  `;
}

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Handle successful payment
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    
    console.log('Payment successful:', session.id);

    try {
      // Get shipping address from Stripe session (can be in different places)
      const shippingDetails = (session as any).shipping_details 
        || (session as any).collected_information?.shipping_details
        || (session as any).customer_details;
      const customerEmail = session.customer_details?.email;

      if (!shippingDetails?.address && !shippingDetails?.name) {
        console.error('No shipping address found');
        return NextResponse.json({ error: 'No shipping address' }, { status: 400 });
      }
      
      // Normalize address structure
      const address = shippingDetails.address || {};
      const customerName = shippingDetails.name || session.customer_details?.name || 'Customer';

      // Parse cart items from metadata
      const metadata = session.metadata || {};
      let orderItems: any[] = [];

      if (metadata.cartItems || metadata.cart_items) {
        // Multiple items from cart - need to fetch variant details
        const cartItems = JSON.parse(metadata.cartItems || metadata.cart_items);
        for (const item of cartItems) {
          const productRes = await fetch(`${PRINTFUL_API_URL}/store/products/${item.productId}`, {
            headers: { 'Authorization': `Bearer ${PRINTFUL_API_TOKEN}` },
          });
          if (productRes.ok) {
            const productData = await productRes.json();
            const variant = productData.result?.sync_variants?.find((v: any) => v.id === item.variantId);
            if (variant) {
              orderItems.push({
                sync_variant_id: variant.id,
                quantity: item.quantity,
              });
            }
          }
        }
      } else if (metadata.printful_product_id) {
        // Single item
        orderItems = [{
          sync_variant_id: parseInt(metadata.printful_variant_id),
          quantity: parseInt(metadata.quantity || '1'),
        }];
      }

      if (orderItems.length === 0) {
        console.error('No order items found');
        return NextResponse.json({ error: 'No items' }, { status: 400 });
      }

      // Create order in Printful
      // Use shorter external_id - Printful has limits on ID format
      const externalId = `BOGX-${Date.now()}-${session.id.slice(-8)}`;
      const orderData = {
        external_id: externalId,
        recipient: {
          name: customerName,
          email: customerEmail || '',
          phone: session.customer_details?.phone || '',
          address1: address.line1 || '',
          address2: address.line2 || '',
          city: address.city || '',
          state_code: address.state || '',
          country_code: address.country || 'DE',
          zip: address.postal_code || '',
        },
        items: orderItems,
      };

      console.log('Creating Printful order:', JSON.stringify(orderData, null, 2));

      const orderRes = await fetch(`${PRINTFUL_API_URL}/orders`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${PRINTFUL_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData),
      });

      const orderResult = await orderRes.json();

      if (!orderRes.ok) {
        console.error('Printful order failed:', orderResult);
        return NextResponse.json({ error: 'Order creation failed', details: orderResult }, { status: 500 });
      }

      console.log('Printful order created:', orderResult.result?.id);

      // Confirm the order (send to production)
      if (orderResult.result?.id) {
        const confirmRes = await fetch(`${PRINTFUL_API_URL}/orders/${orderResult.result.id}/confirm`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${PRINTFUL_API_TOKEN}`,
          },
        });

        if (confirmRes.ok) {
          console.log('Order confirmed and sent to production');
        } else {
          console.log('Order created but not auto-confirmed');
        }
      }

      // Send confirmation email to customer
      if (customerEmail) {
        try {
          // Build order items HTML
          const orderItemsHtml = orderItems.map((item: any) => 
            `<p style="color: #ffffff; font-size: 14px; margin: 8px 0;">• ${item.quantity}x Produkt</p>`
          ).join('');

          // Build shipping address string
          const addressStr = [
            customerName,
            address.line1,
            address.line2,
            `${address.postal_code || ''} ${address.city || ''}`.trim(),
            address.country
          ].filter(Boolean).join('\n');

          // Get total from session
          const totalAmount = `€${((session.amount_total || 0) / 100).toFixed(2)}`;

          await resend.emails.send({
            from: 'Best of GenX <orders@resend.dev>',
            to: customerEmail,
            subject: '🎉 Deine Best of GenX Bestellung ist bestätigt!',
            html: createOrderEmail(
              customerName,
              orderItemsHtml,
              totalAmount,
              addressStr
            ),
          });

          console.log('Confirmation email sent to:', customerEmail);
        } catch (emailError) {
          console.error('Failed to send confirmation email:', emailError);
          // Don't fail the order if email fails
        }
      }

      return NextResponse.json({ 
        success: true, 
        orderId: orderResult.id,
        message: 'Order created, sent to production, and confirmation email sent'
      });

    } catch (error: any) {
      console.error('Error processing order:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}

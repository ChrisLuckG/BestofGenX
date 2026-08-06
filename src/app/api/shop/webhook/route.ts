import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { Resend } from 'resend';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
const resend = new Resend(process.env.RESEND_API_KEY);

const PRINTFUL_API_TOKEN = process.env.PRINTFUL_API_TOKEN;
const PRINTFUL_API_URL = 'https://api.printful.com';

// Best of GenX Order Confirmation Email - Cream Design
function createOrderEmail(customerName: string, orderItems: string, totalAmount: string, shippingAddress: string) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #F5F0E8; font-family: 'Helvetica Neue', Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 0;">

    <!-- Header with logo -->
    <div style="background: linear-gradient(135deg, #FDF8F0 0%, #F5F0E8 100%); padding: 32px 20px; text-align: center;">
      <img src="https://bestofgenx.com/images/genxlogo1.png" alt="BOGX" style="height: 48px; object-fit: contain;" />
    </div>

    <!-- Main Card -->
    <div style="background-color: #FFFDFB; margin: 0 20px; border-radius: 20px; padding: 40px 32px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); position: relative; top: -20px;">
      
      <!-- Badge -->
      <div style="text-align: center; margin-bottom: 28px;">
        <span style="display: inline-block; background-color: #FDF6EE; color: #E36B11; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; padding: 10px 20px; border-radius: 24px; border: 1px solid #F5E6D3;">
          BESTELLUNG BESTÄTIGT
        </span>
      </div>

      <!-- Title -->
      <h1 style="color: #1a1a1a; font-size: 28px; font-weight: 700; margin: 0 0 8px 0; text-align: center; line-height: 1.2;">
        Danke für deine Bestellung!
      </h1>
      
      <p style="color: #666666; font-size: 16px; margin: 0 0 24px 0; text-align: center; line-height: 1.5;">
        Hey <strong style="color: #E36B11;">${customerName}</strong>, wir haben deine Bestellung erhalten.
      </p>

      <!-- Decorative divider -->
      <div style="text-align: center; margin: 24px 0;">
        <div style="display: inline-block; width: 60px; height: 1px; background: linear-gradient(90deg, transparent, #E8E4DC, transparent);"></div>
        <span style="display: inline-block; margin: 0 12px; color: #E36B11; font-size: 14px;">✦</span>
        <div style="display: inline-block; width: 60px; height: 1px; background: linear-gradient(90deg, transparent, #E8E4DC, transparent);"></div>
      </div>

      <!-- Order Details Box -->
      <div style="background-color: #FDF8F0; border-radius: 16px; padding: 24px; margin-bottom: 20px; border: 1px solid #F5E6D3;">
        <h3 style="color: #E36B11; font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px; margin: 0 0 16px 0; font-weight: 700;">Deine Bestellung</h3>
        <div style="color: #555555; font-size: 15px; line-height: 1.8;">
          ${orderItems}
        </div>
        <div style="border-top: 1px solid #E8E4DC; margin-top: 16px; padding-top: 16px;">
          <p style="color: #1a1a1a; font-size: 18px; font-weight: 700; margin: 0;">Gesamt: <span style="color: #E36B11;">${totalAmount}</span></p>
        </div>
      </div>
      
      <!-- Shipping Address Box -->
      <div style="background-color: #FDF8F0; border-radius: 16px; padding: 24px; margin-bottom: 24px; border: 1px solid #F5E6D3;">
        <h3 style="color: #E36B11; font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px; margin: 0 0 16px 0; font-weight: 700;">Lieferadresse</h3>
        <p style="color: #555555; font-size: 14px; line-height: 1.7; margin: 0; white-space: pre-line;">${shippingAddress}</p>
      </div>

      <!-- Info Note -->
      <div style="background-color: #FDF8F0; border-radius: 12px; padding: 16px; border: 1px solid #F5E6D3;">
        <p style="color: #666666; font-size: 14px; line-height: 1.6; margin: 0; text-align: center;">
          Deine Bestellung wird jetzt liebevoll für dich produziert.<br>
          Du erhältst eine E-Mail mit Tracking-Infos sobald dein Paket unterwegs ist!
        </p>
      </div>

      <!-- Welcome message -->
      <p style="color: #E36B11; font-size: 15px; font-weight: 600; margin: 24px 0 0 0; text-align: center;">
        Welcome to the GenX Club!
      </p>
    </div>

    <!-- Footer -->
    <div style="padding: 24px 20px 40px; text-align: center;">
      <p style="color: #AAAAAA; font-size: 11px; margin: 0;">
        Best of GenX · <a href="https://bestofgenx.com" style="color: #E36B11; text-decoration: none;">bestofgenx.com</a>
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
    
    // CRITICAL: Check if this is a TEST payment - do NOT send to Printful!
    const isTestMode = process.env.STRIPE_SECRET_KEY?.startsWith('sk_test');
    if (isTestMode) {
      console.log('⚠️ TEST MODE - Skipping Printful order creation for session:', session.id);
      return NextResponse.json({ 
        received: true, 
        test_mode: true, 
        message: 'Test payment - no Printful order created' 
      });
    }
    
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
            from: 'Best of GenX <orders@bestofgenx.com>',
            to: customerEmail,
            subject: 'Deine Best of GenX Bestellung ist bestätigt',
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

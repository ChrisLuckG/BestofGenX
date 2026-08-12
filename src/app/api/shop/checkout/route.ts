import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';
import GameResult from '@/models/GameResult';

// Debug: Log which key is being used
const secretKey = process.env.STRIPE_SECRET_KEY!;
console.log('🔑 STRIPE KEY TYPE:', secretKey?.startsWith('sk_test') ? 'TEST' : secretKey?.startsWith('sk_live') ? 'LIVE' : 'UNKNOWN');

const stripe = new Stripe(secretKey);

const PRINTFUL_API_TOKEN = process.env.PRINTFUL_API_TOKEN;
const PRINTFUL_API_URL = 'https://api.printful.com';

interface CartItem {
  productId: string;
  variantId: number;
  quantity: number;
}

// POST - Create Stripe Checkout Session (supports single product or cart)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { productId, variantId, quantity = 1, cartItems, paymentMethod, userId, pointsToDeduct, returnPath } = body;
    
    // Get base URL - always use bestofgenx.com for production
    const host = request.headers.get('host') || 'localhost:3000';
    const isLocal = host.includes('localhost') || host.includes('192.168');
    const baseUrl = isLocal 
      ? `http://${host}` 
      : 'https://www.bestofgenx.com';

    // Handle Points Payment
    if (paymentMethod === 'points' && userId && pointsToDeduct > 0) {
      await dbConnect();
      
      // Block bots from using the shop
      const checkUser = await User.findById(userId).select('isBot');
      if (checkUser?.isBot) {
        return NextResponse.json({ 
          success: false, 
          error: 'Bots cannot use the shop' 
        }, { status: 403 });
      }
      
      // Check if user has enough BOGX (atomic operation)
      const user = await User.findOneAndUpdate(
        { _id: userId, bogxCoins: { $gte: pointsToDeduct } },
        { $inc: { bogxCoins: -pointsToDeduct } },
        { new: true }
      );
      
      if (!user) {
        return NextResponse.json({ 
          success: false, 
          error: 'Not enough BOGX' 
        }, { status: 400 });
      }

      // Record ledger entry so ranking scores stay in sync with the wallet
      try {
        const today = new Date().toLocaleString('en-CA', {
          timeZone: 'Europe/Berlin',
          year: 'numeric', month: '2-digit', day: '2-digit'
        }).split(',')[0];
        await GameResult.create({
          userId: user._id,
          username: user.username,
          cardId: 'shop-checkout',
          question: 'Shop purchase (points payment)',
          userAnswer: null,
          correctAnswer: '-',
          isCorrect: false,
          pointsChange: -pointsToDeduct,
          pointsBefore: (user.bogxCoins || 0) + pointsToDeduct,
          pointsAfter: user.bogxCoins,
          timeUsed: 0,
          difficulty: 1,
          skipped: false,
          timedOut: false,
          gameDate: today,
        });
      } catch (e) {
        console.error('shop/checkout: failed to create GameResult:', e);
      }
      
      // TODO: Create order in Printful (you'll pay for it manually)
      // For now, just log the order
      console.log('Points order placed:', {
        userId,
        pointsDeducted: pointsToDeduct,
        cartItems,
        timestamp: new Date().toISOString()
      });
      
      return NextResponse.json({ 
        success: true, 
        message: 'Order placed with coins',
        pointsDeducted: pointsToDeduct,
        newBalance: user.bogxCoins
      });
    }

    let lineItems: any[] = [];
    let metadata: Record<string, string> = {};

    // Handle cart checkout (multiple items)
    const enrichedCartItems: any[] = [];
    
    if (cartItems && cartItems.length > 0) {
      for (const item of cartItems as CartItem[]) {
        const productRes = await fetch(`${PRINTFUL_API_URL}/store/products/${item.productId}`, {
          headers: { 'Authorization': `Bearer ${PRINTFUL_API_TOKEN}` },
        });
        
        if (!productRes.ok) continue;

        const productData = await productRes.json();
        const fullProduct = productData.result;
        
        const variant = fullProduct.sync_variants?.find((v: any) => v.id === item.variantId) 
          || fullProduct.sync_variants?.[0];

        if (!variant) continue;

        const image = fullProduct.sync_product?.thumbnail_url || '';
        const price = parseFloat(variant.retail_price || '0');
        const priceInCents = Math.round(price * 100);

        lineItems.push({
          price_data: {
            currency: 'eur',
            product_data: {
              name: fullProduct.sync_product?.name || 'Product',
              description: `Size: ${variant.name || 'Standard'}`,
              images: image ? [image] : [],
            },
            unit_amount: priceInCents,
          },
          quantity: item.quantity,
        });

        // Store enriched cart item for webhook (no image URL - keeps metadata under 500 chars)
        enrichedCartItems.push({
          productId: item.productId,
          productName: (fullProduct.sync_product?.name || 'Product').slice(0, 40),
          variantId: item.variantId,
          variantTitle: (variant.name || 'Standard').slice(0, 20),
          quantity: item.quantity,
          price: price,
        });
      }

      metadata.cartItems = JSON.stringify(enrichedCartItems);
      if (userId) metadata.userId = userId;
    } 
    // Handle single product checkout
    else if (productId) {
      const productRes = await fetch(`${PRINTFUL_API_URL}/store/products/${productId}`, {
        headers: { 'Authorization': `Bearer ${PRINTFUL_API_TOKEN}` },
      });
      
      if (!productRes.ok) {
        throw new Error('Product not found');
      }

      const productData = await productRes.json();
      const fullProduct = productData.result;
      
      const variant = variantId 
        ? fullProduct.sync_variants?.find((v: any) => v.id === variantId)
        : fullProduct.sync_variants?.[0];

      if (!variant) {
        throw new Error('No variant available');
      }

      const image = fullProduct.sync_product?.thumbnail_url || '';
      const priceInCents = Math.round(parseFloat(variant.retail_price || '0') * 100);

      lineItems.push({
        price_data: {
          currency: 'eur',
          product_data: {
            name: fullProduct.sync_product?.name || 'Product',
            description: `Size: ${variant.name || 'Standard'}`,
            images: image ? [image] : [],
          },
          unit_amount: priceInCents,
        },
        quantity: quantity,
      });

      metadata.printful_product_id = productId;
      metadata.printful_variant_id = variant.id.toString();
      metadata.printful_external_variant_id = variant.variant_id?.toString() || '';
      metadata.quantity = quantity.toString();
    } else {
      return NextResponse.json({ 
        success: false, 
        error: 'No products provided' 
      }, { status: 400 });
    }

    if (lineItems.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'No valid products found' 
      }, { status: 400 });
    }

    // Determine return path (mobile or desktop)
    const path = returnPath === '/desktop' ? '/desktop' : '/mobile';

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${baseUrl}${path}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}${path}?checkout=cancelled`,
      metadata,
      shipping_address_collection: {
        allowed_countries: ['DE', 'AT', 'CH', 'US', 'GB', 'FR', 'IT', 'ES', 'NL', 'BE'],
      },
    });

    return NextResponse.json({ 
      success: true, 
      sessionId: session.id,
      url: session.url,
    });

  } catch (error: any) {
    console.error('Checkout error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';

const PRINTFUL_API_TOKEN = process.env.PRINTFUL_API_TOKEN;
const PRINTFUL_API_URL = 'https://api.printful.com';

// GET - Fetch all products from Printful
export async function GET() {
  if (!PRINTFUL_API_TOKEN) {
    return NextResponse.json({ 
      success: false, 
      error: 'Printful API token not configured' 
    }, { status: 500 });
  }

  try {
    // Fetch store info to get store ID
    const storeRes = await fetch(`${PRINTFUL_API_URL}/stores`, {
      cache: 'no-store',
      headers: {
        'Authorization': `Bearer ${PRINTFUL_API_TOKEN}`,
      },
    });

    if (!storeRes.ok) {
      const errorData = await storeRes.json().catch(() => ({}));
      throw new Error(`Failed to fetch stores: ${JSON.stringify(errorData)}`);
    }

    const storeData = await storeRes.json();
    const stores = storeData.result || [];
    
    if (!stores || stores.length === 0) {
      return NextResponse.json({ 
        success: true, 
        products: [],
        message: 'No stores found'
      });
    }

    const storeId = stores[0].id;

    // Fetch products from the store
    const productsRes = await fetch(`${PRINTFUL_API_URL}/store/products`, {
      cache: 'no-store',
      headers: {
        'Authorization': `Bearer ${PRINTFUL_API_TOKEN}`,
      },
    });

    if (!productsRes.ok) {
      const errorData = await productsRes.json().catch(() => ({}));
      throw new Error(`Failed to fetch products: ${JSON.stringify(errorData)}`);
    }

    const productsData = await productsRes.json();
    const productsList = productsData.result || [];
    
    // Fetch detailed info for each product
    const products = await Promise.all(
      productsList.map(async (product: any) => {
        try {
          // Get full product details
          const detailRes = await fetch(`${PRINTFUL_API_URL}/store/products/${product.id}`, {
            cache: 'no-store',
            headers: {
              'Authorization': `Bearer ${PRINTFUL_API_TOKEN}`,
            },
          });
          
          if (!detailRes.ok) return null;
          
          const detailData = await detailRes.json();
          const fullProduct = detailData.result;
          
          // Get images from sync_variants
          const allImages: string[] = [];
          if (fullProduct.sync_product?.thumbnail_url) {
            allImages.push(fullProduct.sync_product.thumbnail_url);
          }
          
          // Add only preview images with actual print (not blank mockups)
          for (const variant of (fullProduct.sync_variants || [])) {
            if (variant.files) {
              for (const file of variant.files) {
                // Only include 'preview' type - these have the actual print on them
                // Skip 'default' type as those are blank mockups without print
                if (file.type === 'preview' && file.preview_url) {
                  if (!allImages.includes(file.preview_url)) {
                    allImages.push(file.preview_url);
                  }
                }
              }
            }
            // DON'T add variant.product.image - those are blank mockups without print
          }
          
          // Log for debugging
          console.log(`Product ${fullProduct.sync_product?.name}: ${allImages.length} images found`);
          
          // Get price from first variant (Printful prices are in cents as string)
          const firstVariant = fullProduct.sync_variants?.[0];
          const price = firstVariant?.retail_price || '0.00';
          
          // Get available variants
          const variants = (fullProduct.sync_variants || []).map((v: any) => ({
            id: v.id,
            title: v.name,
            price: v.retail_price || '0.00',
            available: true,
            sku: v.sku,
            variantId: v.variant_id,
          }));
          
          // Determine category
          let category = 'apparel';
          const title = (fullProduct.sync_product?.name || '').toLowerCase();
          if (title.includes('mug') || title.includes('cup') || title.includes('tasse')) {
            category = 'drinkware';
          } else if (title.includes('bag') || title.includes('cap') || title.includes('hat') || title.includes('towel') || title.includes('poster') || title.includes('sticker')) {
            category = 'accessories';
          }

          return {
            id: fullProduct.sync_product?.id,
            name: fullProduct.sync_product?.name,
            description: '',
            price: `€${price}`,
            image: allImages[0] || '',
            images: allImages,
            variants,
            category,
          };
        } catch (err) {
          console.error('Error fetching product details:', err);
          return null;
        }
      })
    );

    // Filter out failed products
    const validProducts = products.filter(p => p !== null);

    return NextResponse.json({ 
      success: true, 
      products: validProducts,
      storeId,
    });

  } catch (error: any) {
    console.error('Printful API error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

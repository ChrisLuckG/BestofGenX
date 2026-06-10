import { NextResponse } from 'next/server';

const PRINTFUL_API_TOKEN = process.env.PRINTFUL_API_TOKEN;
const PRINTFUL_API_URL = 'https://api.printful.com';

// POST - Printful products are managed in their dashboard, not via API publish
// This endpoint is kept for compatibility but Printful handles publishing differently
export async function POST(request: Request) {
  if (!PRINTFUL_API_TOKEN) {
    return NextResponse.json({ 
      success: false, 
      error: 'Printful API token not configured' 
    }, { status: 500 });
  }

  try {
    const { productId } = await request.json();

    if (!productId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Product ID required' 
      }, { status: 400 });
    }

    // Printful doesn't have a publish endpoint like Printify
    // Products are managed directly in the Printful dashboard
    return NextResponse.json({ 
      success: true, 
      message: 'Printful products are managed in the dashboard',
      productId,
    });

  } catch (error: any) {
    console.error('Publish error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

// DELETE - Delete a product from Printful
export async function DELETE(request: Request) {
  if (!PRINTFUL_API_TOKEN) {
    return NextResponse.json({ 
      success: false, 
      error: 'Printful API token not configured' 
    }, { status: 500 });
  }

  try {
    const { productId } = await request.json();

    if (!productId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Product ID required' 
      }, { status: 400 });
    }

    // Delete the product from Printful
    const deleteRes = await fetch(
      `${PRINTFUL_API_URL}/store/products/${productId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${PRINTFUL_API_TOKEN}`,
        },
      }
    );

    if (!deleteRes.ok) {
      const errorData = await deleteRes.json().catch(() => ({}));
      throw new Error(errorData.error?.message || 'Failed to delete product');
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Product deleted successfully',
      productId,
    });

  } catch (error: any) {
    console.error('Delete error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

// GET - List all products for admin
export async function GET() {
  if (!PRINTFUL_API_TOKEN) {
    return NextResponse.json({ 
      success: false, 
      error: 'Printful API token not configured' 
    }, { status: 500 });
  }

  try {
    const productsRes = await fetch(`${PRINTFUL_API_URL}/store/products`, {
      headers: {
        'Authorization': `Bearer ${PRINTFUL_API_TOKEN}`,
      },
    });

    const productsData = await productsRes.json();
    const productsList = productsData.result || [];

    // Return all products
    const products = productsList.map((p: any) => ({
      id: p.id,
      title: p.name,
      visible: true, // Printful products are always visible once created
      thumbnail_url: p.thumbnail_url,
    }));

    return NextResponse.json({ 
      success: true, 
      products,
    });

  } catch (error: any) {
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

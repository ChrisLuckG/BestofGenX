import { NextResponse } from 'next/server'
import { printifyService } from '@/lib/printify'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const product = await printifyService.getProduct(params.id)
    
    // Add mockup images to variants
    const variantsWithImages = (product.variants || []).map((variant: any) => ({
      ...variant,
      image: `https://images-api.printify.com/mockup/${product.id}/${variant.id}/98502/product.jpg?camera_label=front`
    }))
    
    const transformedProduct = {
      id: product.id,
      title: product.title,
      description: product.description || '',
      price: (product.variants?.[0]?.price || 0) / 100,
      currency: 'EUR',
      images: product.images?.map((img: any) => img.src) || [],
      variants: variantsWithImages,
      tags: product.tags || []
    }
    
    return NextResponse.json({ success: true, data: transformedProduct })
  } catch (error) {
    console.error('Product API error:', error)
    return NextResponse.json(
      { success: false, error: 'Product not found' },
      { status: 404 }
    )
  }
}

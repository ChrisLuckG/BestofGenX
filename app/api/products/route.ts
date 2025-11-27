import { NextResponse } from 'next/server'
import { printifyService } from '@/lib/printify'

export async function GET() {
  try {
    console.log('Fetching products from Printify...')
    const products = await printifyService.getProducts()
    console.log('Got products:', products.length)
    
    if (!products || products.length === 0) {
      console.log('No products from Printify, returning MOCK product')
      // FALLBACK: Return a mock product so you see SOMETHING
      return NextResponse.json({ 
        success: true, 
        data: [{
          id: 1,
          title: 'BestOfGenX T-Shirt',
          description: 'Your Printify product will appear here once API is working',
          price: 29.99,
          currency: 'EUR',
          images: ['https://via.placeholder.com/400/000000/FFFFFF?text=BestOfGenX'],
          variants: [],
          tags: ['music']
        }]
      })
    }
    
    // Transform products
    const transformedProducts = products.map((product: any) => {
      const variants = product.variants || []
      const variantsWithImages = variants.map((variant: any) => ({
        ...variant,
        image: `https://images-api.printify.com/mockup/${product.id}/${variant.id}/98502/product.jpg?camera_label=front`
      }))
      
      return {
        id: product.id,
        title: product.title,
        description: product.description || '',
        price: (variants[0]?.price || 0) / 100,
        currency: 'EUR',
        images: product.images?.map((img: any) => img.src) || [],
        variants: variantsWithImages,
        tags: product.tags || []
      }
    })
    
    console.log('Returning', transformedProducts.length, 'transformed products')
    return NextResponse.json({ success: true, data: transformedProducts })
  } catch (error: any) {
    console.error('Products API error:', error.message)
    console.error('Full error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch products', data: [] },
      { status: 200 }
    )
  }
}

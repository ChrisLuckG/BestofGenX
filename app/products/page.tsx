'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'

interface Product {
  id: number
  name: string
  price: number
  category: string
  image: string
  images: string[]
}

export default function ProductsPage() {
  const searchParams = useSearchParams()
  const category = searchParams.get('category')
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [currentImageIndex, setCurrentImageIndex] = useState<Record<number, number>>({})

  useEffect(() => {
    fetch('/api/products')
      .then(res => res.json())
      .then(response => {
        console.log('FULL API RESPONSE:', JSON.stringify(response, null, 2))
        
        // Try different response formats
        let productsArray = response.data || response.products || response || []
        
        if (!Array.isArray(productsArray)) {
          console.error('Response is not an array:', productsArray)
          setProducts([])
          setLoading(false)
          return
        }
        
        if (productsArray.length === 0) {
          console.error('No products in array')
          setProducts([])
          setLoading(false)
          return
        }
        
        console.log('Found', productsArray.length, 'products')
        console.log('First product:', productsArray[0])
        
        const mapped = productsArray.map((p: any) => ({
          id: p.id,
          name: p.title || p.name || 'Unnamed Product',
          price: p.price || 0,
          category: p.tags?.[0] || p.category || 'general',
          image: p.images?.[0] || p.variants?.[0]?.image || p.image || 'https://via.placeholder.com/400',
          images: p.images || (p.variants?.slice(0, 4).map((v: any) => v.image).filter(Boolean)) || []
        }))
        
        console.log('Mapped products:', mapped)
        
        setProducts(mapped)
        setLoading(false)
      })
      .catch(err => {
        console.error('Fetch Error:', err)
        setProducts([])
        setLoading(false)
      })
  }, [category])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  const categoryName = category ? category.charAt(0).toUpperCase() + category.slice(1) : 'All Products'

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-primary/10 to-primary/5 py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl">
            <h1 className="text-5xl md:text-7xl font-bold mb-6">
              {category ? `Best of ${categoryName}` : 'All Products'}
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-8">
              Discover our curated collection of {categoryName.toLowerCase()} products
            </p>
            
            {/* Quiz CTA */}
            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-2xl">
              <h2 className="text-2xl font-bold mb-4">What's Your Vibe?</h2>
              <p className="text-muted-foreground mb-6">
                Answer a few questions and we'll recommend the perfect {categoryName.toLowerCase()} products for you
              </p>
              <button className="bg-black text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-800 transition">
                Start Quiz
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Products Carousel */}
      <div className="container mx-auto px-4 py-12">
        <h2 className="text-3xl font-bold mb-8">Featured Products</h2>
        <div className="relative">
          {/* Carousel Container */}
          <div className="flex overflow-x-auto gap-6 pb-4 snap-x snap-mandatory scrollbar-hide">
            {products.map((product) => {
              const currentIndex = currentImageIndex[product.id] || 0
              const displayImages = product.images.length > 0 ? product.images : [product.image]
              const currentImg = displayImages[currentIndex]
              
              return (
            <div
              key={product.id}
              className="group bg-white rounded-xl border-2 border-gray-100 overflow-hidden hover:border-black hover:shadow-2xl transition-all duration-300 flex-shrink-0 w-72 snap-start"
            >
              <Link href={`/products/${product.id}`} className="block">
                <div className="aspect-square relative overflow-hidden bg-gray-50">
                  <img
                    src={currentImg}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  {/* Price Badge */}
                  <div className="absolute top-3 right-3 bg-black text-white px-3 py-1.5 rounded-full font-bold text-sm shadow-lg">
                    ${product.price}
                  </div>
                  
                  {/* Carousel Arrows - Always Visible */}
                  {displayImages.length > 1 && (
                    <>
                      <button
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setCurrentImageIndex(prev => ({
                            ...prev,
                            [product.id]: currentIndex > 0 ? currentIndex - 1 : displayImages.length - 1
                          }))
                        }}
                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white p-1.5 rounded-full shadow-lg z-10"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setCurrentImageIndex(prev => ({
                            ...prev,
                            [product.id]: currentIndex < displayImages.length - 1 ? currentIndex + 1 : 0
                          }))
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white p-1.5 rounded-full shadow-lg z-10"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                      
                      {/* Dots Indicator */}
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                        {displayImages.map((_, idx) => (
                          <button
                            key={idx}
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              setCurrentImageIndex(prev => ({
                                ...prev,
                                [product.id]: idx
                              }))
                            }}
                            className={`h-2 rounded-full transition-all shadow-md ${
                              idx === currentIndex ? 'bg-black w-4' : 'bg-gray-400 w-2'
                            }`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>
                <div className="p-4 border-t-2 border-gray-100">
                  <h3 className="font-semibold text-base group-hover:text-black transition line-clamp-2">
                    {product.name}
                  </h3>
                </div>
              </Link>
            </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

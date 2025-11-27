'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, ShoppingCart } from 'lucide-react'
import { useCartStore } from '@/lib/store'

interface Variant {
  id: number
  title: string
  price: number
  image: string
}

interface Product {
  id: number
  title: string
  description: string
  price: number
  currency: string
  images: string[]
  variants: Variant[]
  tags: string[]
}

export default function ProductDetailPage() {
  const params = useParams()
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedImage, setSelectedImage] = useState(0)
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null)
  const [selectedColor, setSelectedColor] = useState<string>('')
  const [selectedSize, setSelectedSize] = useState<string>('')
  const [isZoomed, setIsZoomed] = useState(false)
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 })
  const addItem = useCartStore((state) => state.addItem)
  
  // Extract unique colors and sizes from variants
  // Format is "SIZE / COLOR" e.g. "M / Carolina Blue"
  const sizes = product ? [...new Set(product.variants.map(v => {
    const parts = v.title.split('/')
    return parts[0]?.trim() || ''
  }).filter(Boolean))] : []
  
  const colors = product ? [...new Set(product.variants.map(v => {
    const parts = v.title.split('/')
    return parts[1]?.trim() || v.title
  }))].sort((a, b) => {
    // White always first
    if (a === 'White') return -1
    if (b === 'White') return 1
    return 0
  }) : []

  useEffect(() => {
    fetch(`/api/products/${params.id}`)
      .then(res => res.json())
      .then(response => {
        if (response.success && response.data) {
          setProduct(response.data)
          if (response.data.variants?.length > 0) {
            // Find White variant first, otherwise use first variant
            const whiteVariant = response.data.variants.find((v: any) => v.title.includes('White'))
            setSelectedVariant(whiteVariant || response.data.variants[0])
            if (whiteVariant) {
              setSelectedColor('White')
            }
          }
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [params.id])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Product not found</p>
      </div>
    )
  }

  const displayImages = product.images.length > 0 ? product.images : product.variants.map(v => v.image).filter(Boolean)
  // Use the selected image from thumbnails, or fallback to variant image
  const currentImage = displayImages[selectedImage] || selectedVariant?.image || displayImages[0] || 'https://via.placeholder.com/600'

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-4">
        {/* Back Button */}
        <button
          onClick={() => window.history.back()}
          className="mb-4 inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:text-black transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        
        <div className="grid md:grid-cols-2 gap-6">
          {/* Image Gallery with Carousel */}
          <div className="bg-white rounded-lg p-3 border">
            <div 
              className={`relative w-full max-w-sm mx-auto aspect-square bg-gray-50 rounded-lg overflow-hidden mb-3 ${isZoomed ? 'cursor-move' : 'cursor-zoom-in'}`}
              onClick={(e) => {
                if (!isZoomed) {
                  setIsZoomed(true)
                }
              }}
              onMouseMove={(e) => {
                if (isZoomed) {
                  const rect = e.currentTarget.getBoundingClientRect()
                  const x = ((e.clientX - rect.left) / rect.width) * 100
                  const y = ((e.clientY - rect.top) / rect.height) * 100
                  setImagePosition({ x, y })
                }
              }}
              onMouseLeave={() => {
                setIsZoomed(false)
                setImagePosition({ x: 0, y: 0 })
              }}
            >
              <img
                src={currentImage}
                alt={product.title}
                className={`w-full h-full object-contain transition-transform duration-200 ${isZoomed ? 'scale-[2.5]' : 'scale-100'}`}
                style={isZoomed ? {
                  transformOrigin: `${imagePosition.x}% ${imagePosition.y}%`
                } : {}}
              />
              
              {/* Carousel Navigation */}
              {displayImages.length > 1 && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedImage(prev => prev > 0 ? prev - 1 : displayImages.length - 1)
                    }}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white p-2 rounded-full shadow-lg z-10"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedImage(prev => prev < displayImages.length - 1 ? prev + 1 : 0)
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white p-2 rounded-full shadow-lg z-10"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </>
              )}
            </div>
            
            {/* Thumbnails */}
            {displayImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2 justify-center">
                {displayImages.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setSelectedImage(idx)
                      const variant = product.variants.find(v => v.image === img)
                      if (variant) {
                        setSelectedVariant(variant)
                      }
                    }}
                    className={`w-20 h-20 rounded-md overflow-hidden border-2 flex-shrink-0 ${
                      selectedImage === idx ? 'border-black' : 'border-gray-200'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {/* Product Info */}
          <div className="bg-white rounded-lg p-4 border">
            <h1 className="text-2xl font-bold mb-2">{product.title}</h1>
            
            <div className="border-b pb-3 mb-4">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold">${product.price.toFixed(2)}</span>
                <span className="text-xs text-gray-500">{product.currency}</span>
              </div>
            </div>
            
            <div 
              className="text-xs mb-4 text-gray-700 leading-relaxed max-h-32 overflow-y-auto border-b pb-4"
              dangerouslySetInnerHTML={{ __html: product.description }}
            />
            
            {/* Color Selection - NUR FARBEN */}
            {colors.length > 0 && (
              <div className="mb-3">
                <h3 className="font-semibold mb-2 text-xs">Color: <span className="font-normal text-gray-600">{selectedColor || 'Select'}</span></h3>
                <div className="flex flex-wrap gap-2">
                  {colors.map((color) => {
                    const variant = product.variants.find(v => v.title.includes(color))
                    // Map color names to actual colors
                    const colorMap: {[key: string]: string} = {
                      'Light Pink': '#FFB6C1',
                      'Navy': '#000080',
                      'Red': '#FF0000',
                      'Orange': '#FFA500',
                      'Forest Green': '#228B22',
                      'Military Green': '#4B5320',
                      'Purple': '#800080',
                      'Gold': '#FFD700',
                      'Sand': '#C2B280',
                      'Ash': '#B2BEB5',
                      'Irish Green': '#009A49',
                      'Light Blue': '#ADD8E6',
                      'White': '#FFFFFF',
                      'Maroon': '#800000',
                      'Heliconia': '#FF00FF',
                      'Royal': '#4169E1',
                      'Graphite Heather': '#383838',
                      'Sport Grey': '#A8A8A8',
                      'Dark Heather': '#616161',
                      'Black': '#000000',
                      'Cherry Red': '#D2042D',
                      'Safety Green': '#76FF7A',
                      'Antique Sapphire': '#0F52BA',
                      'Carolina Blue': '#56A0D3',
                      'Cardinal Red': '#C41E3A',
                      'Heather Scarlet Red': '#CD5C5C',
                      'Charcoal': '#36454F',
                      'Dark Chocolate': '#3B2F2F',
                      'Heather Sport Dark Navy': '#1C2841',
                      'Garnet': '#733635',
                      'Sapphire': '#0F52BA',
                      'Heather Scarlet Red': '#CD5C5C',
                      'Heather Sport Dark Maroon': '#5C2E2E',
                      'Antique Cherry Red': '#9B2D30',
                      'Safety Orange': '#FF6600',
                      'Indigo Blue': '#4B0082',
                      'Safety Pink': '#FF69B4',
                      'Dark Chocolate': '#3B2F2F'
                    }
                    const bgColor = colorMap[color] || '#CCCCCC'
                    
                    return (
                      <button
                        key={color}
                        onClick={() => {
                          setSelectedColor(color)
                          if (variant) {
                            setSelectedVariant(variant)
                            // Change preview image to variant image
                            if (variant.image) {
                              // Find the index of this variant's image in displayImages
                              const imgIndex = displayImages.findIndex(img => img === variant.image)
                              if (imgIndex !== -1) {
                                setSelectedImage(imgIndex)
                              } else {
                                // If not found, add it to the beginning
                                setSelectedImage(0)
                              }
                            }
                          }
                        }}
                        className={`relative w-7 h-7 rounded-full border-2 ${
                          selectedColor === color ? 'border-black ring-1 ring-offset-1 ring-black' : 'border-gray-300'
                        }`}
                        style={{ backgroundColor: bgColor }}
                        title={color}
                      >
                        {bgColor === '#FFFFFF' && <div className="absolute inset-0 rounded-full border border-gray-200"></div>}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            
            {/* Size Selection - DROPDOWN */}
            {sizes.length > 0 && (
              <div className="mb-3">
                <h3 className="font-semibold mb-2 text-xs">Size:</h3>
                <select
                  value={selectedSize}
                  onChange={(e) => {
                    setSelectedSize(e.target.value)
                    // Find variant with selected color and size
                    const variant = product.variants.find(v => 
                      v.title.includes(selectedColor) && v.title.includes(e.target.value)
                    )
                    if (variant) {
                      setSelectedVariant(variant)
                    }
                  }}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg font-medium focus:border-black focus:outline-none"
                >
                  <option value="">Select Size</option>
                  {sizes.map((size) => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </div>
            )}
            
            <button
              onClick={() => addItem({
                id: product.id,
                name: product.title,
                price: selectedVariant?.price ? selectedVariant.price / 100 : product.price,
                image: currentImage,
                quantity: 1
              })}
              className="w-full bg-black text-white px-8 py-4 rounded-lg font-semibold hover:bg-gray-800 transition flex items-center justify-center gap-2"
            >
              <ShoppingCart className="h-5 w-5" />
              Add to Cart
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

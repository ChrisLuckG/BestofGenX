'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Search, ShoppingCart } from 'lucide-react'
import { useSession, signOut } from 'next-auth/react'
import { useCartStore } from '@/lib/store'
import LoginModal from './LoginModal'

const categories = [
  { name: 'BestofMusic', href: '/products?category=music' },
  { name: 'BestofSport', href: '/products?category=sport' },
  { name: 'BestofMovie', href: '/products?category=movie' },
  { name: 'BestofGaming', href: '/products?category=gaming' },
  { name: 'BestofArt', href: '/products?category=art' },
]

export default function Header() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  const getTotalItems = useCartStore((state) => state.getTotalItems)
  const [totalItems, setTotalItems] = useState(0)
  const [showLoginModal, setShowLoginModal] = useState(false)

  // Fix hydration error by only showing cart count on client
  useEffect(() => {
    setTotalItems(getTotalItems())
  }, [getTotalItems])

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    // Check if the category parameter matches
    const urlParams = new URLSearchParams(href.split('?')[1])
    const category = urlParams.get('category')
    if (!category) return false
    // Use Next.js searchParams hook
    const currentCategory = searchParams.get('category')
    return pathname?.includes('/products') && currentCategory === category
  }
  
  return (
    <header className="sticky top-0 z-50 bg-white border-b">
      <div className="container mx-auto px-4 py-3 md:py-4">
        <div className="flex items-center justify-between gap-2 md:gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <img 
              src="/images/Logo/logo.png" 
              alt="BestOfGenX Logo" 
              className="h-8 md:h-10 w-auto"
            />
            <span className="hidden sm:inline text-lg md:text-2xl font-bold">BestOfGenX</span>
          </Link>

          {/* Search - Hidden on mobile */}
          <div className="hidden md:flex flex-1 max-w-xl">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="What products are you looking for?"
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-2 md:gap-4">
            <Link href="/cart" className="relative">
              <ShoppingCart className="h-5 w-5 md:h-6 md:w-6" />
              {totalItems > 0 && (
                <span className="absolute -top-2 -right-2 bg-primary text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {totalItems}
                </span>
              )}
            </Link>

            {session ? (
              <div className="flex items-center gap-2 md:gap-3">
                {session.user?.image && (
                  <img src={session.user.image} alt="User" className="w-6 h-6 md:w-8 md:h-8 rounded-full" />
                )}
                <button
                  onClick={() => signOut()}
                  className="text-xs md:text-sm hover:text-primary hidden sm:block"
                >
                  Log out
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1 md:gap-2">
                <button
                  onClick={() => setShowLoginModal(true)}
                  className="px-2 py-1 md:px-4 md:py-2 text-xs md:text-sm hover:text-primary"
                >
                  Log in
                </button>
                <button
                  onClick={() => setShowLoginModal(true)}
                  className="px-2 py-1 md:px-4 md:py-2 bg-black text-white rounded-lg text-xs md:text-sm hover:bg-gray-800"
                >
                  Sign up
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Navigation Menu - Full Width Border */}
      <div className="border-t">
        <nav className="container mx-auto px-4 flex items-center gap-3 md:gap-6 py-3 md:py-4 overflow-x-auto scrollbar-hide">
          {categories.map((category) => (
            <Link
              key={category.name}
              href={category.href}
              className={`text-xs md:text-sm font-medium transition whitespace-nowrap pb-1 border-b-2 ${
                isActive(category.href)
                  ? 'text-primary border-primary'
                  : 'text-foreground border-transparent hover:text-primary hover:border-primary/50'
              }`}
            >
              {category.name}
            </Link>
          ))}
        </nav>
      </div>
      
      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </header>
  )
}

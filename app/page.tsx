'use client'

import Link from 'next/link'

const categories = [
  { name: 'BestofMusic', href: '/products?category=music' },
  { name: 'BestofSport', href: '/products?category=sport' },
  { name: 'BestofMovie', href: '/products?category=movie' },
]

export default function HomePage() {
  return (
    <div className="bg-white">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-r from-primary/10 to-primary/5 py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl">
            <h1 className="text-5xl md:text-7xl font-bold mb-6">
              Discover Your <span className="text-primary">Perfect Style</span>
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-8">
              Take our quiz to find products that match your personality
            </p>
            
            {/* Quiz CTA */}
            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-2xl">
              <h2 className="text-2xl font-bold mb-4">What's Your Vibe?</h2>
              <p className="text-muted-foreground mb-6">
                Answer a few questions and we'll recommend the perfect products for you
              </p>
              <button className="bg-black text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-800 transition">
                Start Quiz
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Preview */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Explore Our Collections</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {categories.slice(0, 3).map((category) => (
              <Link
                key={category.name}
                href={category.href}
                className="group relative aspect-square rounded-2xl overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 hover:shadow-xl transition"
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <h3 className="text-2xl font-bold group-hover:scale-110 transition">
                    {category.name}
                  </h3>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

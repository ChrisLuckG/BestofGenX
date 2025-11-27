import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Providers from './providers'
import LoadingBar from '@/components/LoadingBar'
import Header from '@/components/Header'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'BestOfGenX Shop',
  description: 'Your favorite products from the Gen X era',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="de">
      <body className={inter.className}>
        <Providers>
          <LoadingBar />
          <Header />
          <main className="pt-4">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  )
}

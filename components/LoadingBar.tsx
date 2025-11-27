'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

export default function LoadingBar() {
  const pathname = usePathname()
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    setLoading(true)
    setProgress(20)

    const timer1 = setTimeout(() => setProgress(60), 100)
    const timer2 = setTimeout(() => setProgress(90), 300)
    const timer3 = setTimeout(() => {
      setProgress(100)
      setTimeout(() => setLoading(false), 200)
    }, 500)

    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
      clearTimeout(timer3)
    }
  }, [pathname])

  if (!loading) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[100]">
      {/* Progress Bar */}
      <div className="h-1 bg-gradient-to-r from-primary via-blue-500 to-primary transition-all duration-300 ease-out" style={{ width: `${progress}%` }} />
    </div>
  )
}

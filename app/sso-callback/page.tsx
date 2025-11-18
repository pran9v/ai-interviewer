'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function SSOCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    // Clerk handles the OAuth callback automatically
    // Just redirect to dashboard after a short delay
    const timer = setTimeout(() => {
      router.push('/dashboard')
    }, 2000)

    return () => clearTimeout(timer)
  }, [router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4" />
        <p className="text-lg text-gray-600">Completing sign in...</p>
      </div>
    </div>
  )
}

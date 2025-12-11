'use client'

import { Suspense } from 'react'
import { AuthenticateWithRedirectCallback } from '@clerk/nextjs'
import { Loader2 } from 'lucide-react'
import { useSearchParams } from 'next/navigation'

function SSOCallbackInner() {
  const searchParams = useSearchParams()
  const redirectUrl = searchParams?.get('redirect_url') || '/dashboard'

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4" />
        <p className="text-lg text-gray-600">Completing sign in...</p>
      </div>
      <AuthenticateWithRedirectCallback redirectUrl={redirectUrl} />
    </div>
  )
}

export default function SSOCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4" />
            <p className="text-lg text-gray-600">Completing sign in...</p>
          </div>
        </div>
      }
    >
      <SSOCallbackInner />
    </Suspense>
  )
}

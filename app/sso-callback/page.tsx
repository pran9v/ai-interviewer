'use client'

import { Suspense } from 'react'
import { AuthenticateWithRedirectCallback } from '@clerk/nextjs'
import { Loader2 } from 'lucide-react'
import { useSearchParams } from 'next/navigation'

function SSOCallbackInner() {
  const searchParams = useSearchParams()
  const clerkStatus = searchParams?.get('__clerk_status')
  const defaultRedirect = clerkStatus === 'sign_up' ? '/onboarding?mode=signup' : '/dashboard'
  const redirectUrl = searchParams?.get('redirect_url') || defaultRedirect

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4" />
        <p className="text-lg text-gray-600">Completing sign in...</p>
      </div>
      <AuthenticateWithRedirectCallback
        redirectUrl={redirectUrl}
        afterSignInUrl={redirectUrl}
        afterSignUpUrl={redirectUrl}
        signInUrl="/onboarding?mode=signin"
        signUpUrl="/onboarding"
      />
    </div>
  )
}

export default function SSOCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-linear-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
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

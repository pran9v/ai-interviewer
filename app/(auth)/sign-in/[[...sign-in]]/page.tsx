'use client'

import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function SignInRedirect() {
    const router = useRouter()
    const searchParams = useSearchParams()
    
    useEffect(() => {
        // Redirect to custom onboarding with signin mode without extra history entries
        const redirectUrl = searchParams?.get('redirect_url') || '/dashboard'
        router.replace(`/onboarding?mode=signin&redirect_url=${encodeURIComponent(redirectUrl)}`)
    }, [router, searchParams])

    return null
}

export default function Page() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <SignInRedirect />
        </Suspense>
    )
}
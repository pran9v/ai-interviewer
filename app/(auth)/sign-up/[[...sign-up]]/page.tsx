'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Page() {
    const router = useRouter()
    
    useEffect(() => {
        // Redirect to custom onboarding
        router.push('/onboarding')
    }, [router])

    return null
}
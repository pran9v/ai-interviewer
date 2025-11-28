'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Page() {
    const router = useRouter()
    
    useEffect(() => {
        // Redirect to custom onboarding without polluting history stack
        router.replace('/onboarding')
    }, [router])

    return null
}
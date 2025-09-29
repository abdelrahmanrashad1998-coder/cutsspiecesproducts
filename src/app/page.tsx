'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

export default function Home() {
  const router = useRouter()
  const { firebaseUser, loading } = useAuth()

  useEffect(() => {
    if (!loading) {
      if (firebaseUser) {
        router.push('/dashboard')
      } else {
        router.push('/login')
      }
    }
  }, [firebaseUser, loading, router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
    </div>
  )
}

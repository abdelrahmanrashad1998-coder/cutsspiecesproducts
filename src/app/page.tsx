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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#245468]/10 to-[#fc8a2c]/10">
      <div className="animate-spin rounded-full h-32 w-32 border-b-4 border-[#fc8a2c]"></div>
    </div>
  )
}

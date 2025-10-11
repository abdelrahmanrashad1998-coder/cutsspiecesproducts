'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from './sidebar'
import { useAuth } from '@/contexts/AuthContext'
import { SubscriptionOnboardingModal } from '@/components/subscription-onboarding-modal'
import { FirstShopOnboardingModal } from '@/components/first-shop-onboarding-modal'
import { AccessBlocker } from '@/components/access-blocker'

interface DashboardLayoutProps {
  children: React.ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, firebaseUser, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !firebaseUser) {
      router.push('/login')
    }
  }, [firebaseUser, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (!firebaseUser) {
    return null
  }

  return (
    <AccessBlocker>
      <div className="flex h-screen bg-gray-100">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="p-6">
            {children}
          </div>
        </main>
        <SubscriptionOnboardingModal />
        <FirstShopOnboardingModal />
      </div>
    </AccessBlocker>
  )
}

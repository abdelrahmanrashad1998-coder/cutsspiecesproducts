'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from './sidebar'
import { useAuth } from '@/contexts/AuthContext'
import { SubscriptionOnboardingModal } from '@/components/subscription-onboarding-modal'
import { FirstShopOnboardingModal } from '@/components/first-shop-onboarding-modal'
import { AccessBlocker } from '@/components/access-blocker'
import { Button } from '@/components/ui/button'
import { Menu, X } from 'lucide-react'

interface DashboardLayoutProps {
  children: React.ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, firebaseUser, loading } = useAuth()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (!loading && !firebaseUser) {
      router.push('/login')
    }
  }, [firebaseUser, loading, router])

  // Close sidebar when clicking outside on mobile
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(false)
      }
    }
    
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

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
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        
        {/* Sidebar */}
        <div className={`
          fixed lg:static inset-y-0 left-0 z-50 
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          <Sidebar onClose={() => setSidebarOpen(false)} />
        </div>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          {/* Mobile header */}
          <div className="lg:hidden sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(true)}
                className="text-[#245468]"
              >
                <Menu className="h-6 w-6" />
              </Button>
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 bg-[#fc8a2c] rounded flex items-center justify-center">
                  <span className="text-white text-xs font-bold">R</span>
                </div>
                <span className="font-bold text-[#245468]">Rable</span>
              </div>
              <div className="w-10" /> {/* Spacer for centering */}
            </div>
          </div>

          <div className="p-4 sm:p-6">
            {children}
          </div>
        </main>
        <SubscriptionOnboardingModal />
        <FirstShopOnboardingModal />
      </div>
    </AccessBlocker>
  )
}

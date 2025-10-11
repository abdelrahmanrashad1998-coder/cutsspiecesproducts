'use client'

import { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useSubscription } from '@/contexts/SubscriptionContext'
import { Lock, AlertCircle } from 'lucide-react'

export function AccessBlocker({ children }: { children: React.ReactNode }) {
  const { firebaseUser } = useAuth()
  const { subscription, isAccessBlocked, daysLeftInGracePeriod } = useSubscription()

  // Block rendering if access is not allowed
  if (!firebaseUser || !subscription) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  // If trial not accepted, DON'T block - let the modal show!
  // The modal itself will handle blocking the UI
  if (!subscription.trialAccepted) {
    console.log('⚠️ AccessBlocker: Trial not accepted, rendering children to show modal')
    // Allow children to render so modal can appear
    return <>{children}</>
  }

  // If grace period expired and email not verified, show blocker
  if (isAccessBlocked()) {
    const daysLeft = daysLeftInGracePeriod()
    
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-xl border-4 border-red-500 p-8 text-center">
          <Lock className="h-16 w-16 text-red-600 mx-auto mb-4 animate-pulse" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Account Suspended</h2>
          <p className="text-gray-700 mb-4">
            Your access has been blocked because:
          </p>
          <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 mb-4">
            <ul className="text-sm text-red-800 text-left space-y-2">
              {!firebaseUser.emailVerified && daysLeft <= 0 && (
                <li>❌ Email verification period expired ({daysLeft} days left)</li>
              )}
              {subscription.status === 'expired' && (
                <li>❌ Trial period has ended</li>
              )}
            </ul>
          </div>
          <p className="text-sm text-gray-700 font-semibold mb-4">
            To restore access:
          </p>
          <ul className="text-sm text-gray-600 text-left space-y-2 mb-6">
            <li>1. Verify your email address (check inbox/spam)</li>
            <li>2. OR upgrade to a paid plan</li>
          </ul>
          <a
            href="/pricing"
            className="block w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
          >
            View Upgrade Options
          </a>
        </div>
      </div>
    )
  }

  // Access granted - render children
  return <>{children}</>
}


'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from './AuthContext'

export type SubscriptionPlan = 'free' | 'basic' | 'premium'

export interface SubscriptionData {
  plan: SubscriptionPlan
  status: 'active' | 'expired' | 'cancelled' | 'trial'
  trialEndsAt: Date | null
  subscriptionStartDate: Date
  subscriptionEndDate: Date | null
  monthlyProductGenerations: number
  lastResetDate: Date
  maxShops: number
  maxMonthlyProducts: number | 'unlimited'
  trialAccepted: boolean // User acknowledged trial terms
  emailVerificationRequired: boolean // Must verify email
  gracePeriodEndsAt: Date | null // Grace period for verification (7 days)
}

interface SubscriptionContextType {
  subscription: SubscriptionData | null
  loading: boolean
  canAddShop: (currentShopCount: number) => boolean
  canGenerateProduct: () => boolean
  incrementProductGeneration: () => Promise<void>
  upgradePlan: (plan: SubscriptionPlan) => Promise<void>
  refreshSubscription: () => Promise<void>
  isTrialActive: () => boolean
  daysLeftInTrial: () => number
  acceptTrial: () => Promise<void>
  isAccessBlocked: () => boolean
  daysLeftInGracePeriod: () => number
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined)

const PLAN_LIMITS = {
  free: {
    maxShops: 1,
    maxMonthlyProducts: 20, // Free trial: 20 products per month
    priceEGP: 0,
  },
  basic: {
    maxShops: 2,
    maxMonthlyProducts: 50,
    priceEGP: 500,
  },
  premium: {
    maxShops: 'unlimited' as const,
    maxMonthlyProducts: 'unlimited' as const,
    priceEGP: 750,
  },
}

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user, firebaseUser } = useAuth()
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user && firebaseUser) {
      loadSubscription()
    } else {
      setSubscription(null)
      setLoading(false)
    }
  }, [user, firebaseUser])

  const loadSubscription = async () => {
    if (!firebaseUser) return

    try {
      const subscriptionRef = doc(db, 'subscriptions', firebaseUser.uid)
      const subscriptionSnap = await getDoc(subscriptionRef)

      if (subscriptionSnap.exists()) {
        const data = subscriptionSnap.data()
        const subData: SubscriptionData = {
          plan: data.plan || 'free',
          status: data.status || 'trial',
          trialEndsAt: data.trialEndsAt ? data.trialEndsAt.toDate() : null,
          subscriptionStartDate: data.subscriptionStartDate ? data.subscriptionStartDate.toDate() : new Date(),
          subscriptionEndDate: data.subscriptionEndDate ? data.subscriptionEndDate.toDate() : null,
          monthlyProductGenerations: data.monthlyProductGenerations || 0,
          lastResetDate: data.lastResetDate ? data.lastResetDate.toDate() : new Date(),
          maxShops: PLAN_LIMITS[data.plan as SubscriptionPlan]?.maxShops === 'unlimited' ? 999 : (PLAN_LIMITS[data.plan as SubscriptionPlan]?.maxShops || 1),
          maxMonthlyProducts: PLAN_LIMITS[data.plan as SubscriptionPlan]?.maxMonthlyProducts || 'unlimited',
          trialAccepted: data.trialAccepted || false,
          emailVerificationRequired: data.emailVerificationRequired !== false, // Default true
          gracePeriodEndsAt: data.gracePeriodEndsAt ? data.gracePeriodEndsAt.toDate() : null,
        }

        // Check if trial has expired
        if (subData.status === 'trial' && subData.trialEndsAt && new Date() > subData.trialEndsAt) {
          subData.status = 'expired'
          await updateDoc(subscriptionRef, { status: 'expired' })
        }

        // Reset monthly counter if needed
        const now = new Date()
        const lastReset = subData.lastResetDate
        const daysSinceReset = Math.floor((now.getTime() - lastReset.getTime()) / (1000 * 60 * 60 * 24))
        
        if (daysSinceReset >= 30) {
          subData.monthlyProductGenerations = 0
          subData.lastResetDate = now
          await updateDoc(subscriptionRef, {
            monthlyProductGenerations: 0,
            lastResetDate: now,
          })
        }

        setSubscription(subData)
      } else {
        // Create initial subscription (2-month free trial)
        const trialEndDate = new Date()
        trialEndDate.setMonth(trialEndDate.getMonth() + 2)

        // Grace period: 7 days to verify email
        const gracePeriodEndDate = new Date()
        gracePeriodEndDate.setDate(gracePeriodEndDate.getDate() + 7)

        const initialSub: SubscriptionData = {
          plan: 'free',
          status: 'trial',
          trialEndsAt: trialEndDate,
          subscriptionStartDate: new Date(),
          subscriptionEndDate: null,
          monthlyProductGenerations: 0,
          lastResetDate: new Date(),
          maxShops: 1,
          maxMonthlyProducts: 20,
          trialAccepted: false, // Must accept trial terms
          emailVerificationRequired: true, // Must verify email
          gracePeriodEndsAt: gracePeriodEndDate, // 7 days to verify
        }

        await setDoc(subscriptionRef, {
          plan: initialSub.plan,
          status: initialSub.status,
          trialEndsAt: initialSub.trialEndsAt,
          subscriptionStartDate: initialSub.subscriptionStartDate,
          subscriptionEndDate: initialSub.subscriptionEndDate,
          monthlyProductGenerations: initialSub.monthlyProductGenerations,
          lastResetDate: initialSub.lastResetDate,
          trialAccepted: initialSub.trialAccepted,
          emailVerificationRequired: initialSub.emailVerificationRequired,
          gracePeriodEndsAt: initialSub.gracePeriodEndsAt,
          createdAt: new Date(),
          updatedAt: new Date(),
        })

        setSubscription(initialSub)
      }
    } catch (error) {
      console.error('Error loading subscription:', error)
    } finally {
      setLoading(false)
    }
  }

  const canAddShop = (currentShopCount: number): boolean => {
    if (!subscription) return false
    if (subscription.status === 'expired' || subscription.status === 'cancelled') return false
    if (subscription.maxShops === 999) return true // unlimited
    return currentShopCount < subscription.maxShops
  }

  const canGenerateProduct = (): boolean => {
    if (!subscription) return false
    if (subscription.status === 'expired' || subscription.status === 'cancelled') return false
    if (subscription.maxMonthlyProducts === 'unlimited') return true
    return subscription.monthlyProductGenerations < subscription.maxMonthlyProducts
  }

  const incrementProductGeneration = async () => {
    if (!firebaseUser || !subscription) return

    try {
      const subscriptionRef = doc(db, 'subscriptions', firebaseUser.uid)
      const newCount = subscription.monthlyProductGenerations + 1

      await updateDoc(subscriptionRef, {
        monthlyProductGenerations: newCount,
        updatedAt: new Date(),
      })

      setSubscription({ ...subscription, monthlyProductGenerations: newCount })

      // Log usage
      const usageRef = doc(db, 'usageLogs', `${firebaseUser.uid}_${Date.now()}`)
      await setDoc(usageRef, {
        userId: firebaseUser.uid,
        actionType: 'product_generation',
        timestamp: new Date(),
        metadata: JSON.stringify({ plan: subscription.plan }),
      })
    } catch (error) {
      console.error('Error incrementing product generation:', error)
    }
  }

  const upgradePlan = async (plan: SubscriptionPlan) => {
    if (!firebaseUser || !subscription) return

    try {
      const subscriptionRef = doc(db, 'subscriptions', firebaseUser.uid)
      const now = new Date()
      const endDate = new Date()
      endDate.setMonth(endDate.getMonth() + 1) // 1 month subscription

      await updateDoc(subscriptionRef, {
        plan,
        status: 'active',
        subscriptionStartDate: now,
        subscriptionEndDate: endDate,
        trialAccepted: true, // Mark as accepted when upgrading
        updatedAt: now,
      })

      setSubscription({
        ...subscription,
        plan,
        status: 'active',
        subscriptionStartDate: now,
        subscriptionEndDate: endDate,
        trialAccepted: true, // Mark as accepted
        maxShops: PLAN_LIMITS[plan]?.maxShops === 'unlimited' ? 999 : (PLAN_LIMITS[plan]?.maxShops || 1),
        maxMonthlyProducts: PLAN_LIMITS[plan]?.maxMonthlyProducts || 'unlimited',
      })
    } catch (error) {
      console.error('Error upgrading plan:', error)
      throw error
    }
  }

  const refreshSubscription = async () => {
    await loadSubscription()
  }

  const isTrialActive = (): boolean => {
    if (!subscription) return false
    return subscription.status === 'trial' && subscription.trialEndsAt ? new Date() < subscription.trialEndsAt : false
  }

  const daysLeftInTrial = (): number => {
    if (!subscription || !subscription.trialEndsAt) return 0
    const now = new Date()
    const daysLeft = Math.ceil((subscription.trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return Math.max(0, daysLeft)
  }

  const acceptTrial = async () => {
    if (!firebaseUser || !subscription) return

    try {
      const subscriptionRef = doc(db, 'subscriptions', firebaseUser.uid)
      await updateDoc(subscriptionRef, {
        trialAccepted: true,
        updatedAt: new Date(),
      })

      setSubscription({ ...subscription, trialAccepted: true })
    } catch (error) {
      console.error('Error accepting trial:', error)
      throw error
    }
  }

  const isAccessBlocked = (): boolean => {
    if (!subscription || !firebaseUser) return false
    
    // Allow access if paid plan
    if (subscription.plan !== 'free' || subscription.status === 'active') return false
    
    // Block if trial not accepted
    if (!subscription.trialAccepted) return true
    
    // Block if email not verified and grace period expired
    if (subscription.emailVerificationRequired && !firebaseUser.emailVerified) {
      if (subscription.gracePeriodEndsAt && new Date() > subscription.gracePeriodEndsAt) {
        return true
      }
    }
    
    // Block if trial expired
    if (subscription.status === 'expired') return true
    
    return false
  }

  const daysLeftInGracePeriod = (): number => {
    if (!subscription || !subscription.gracePeriodEndsAt) return 0
    const now = new Date()
    const daysLeft = Math.ceil((subscription.gracePeriodEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return Math.max(0, daysLeft)
  }

  const value = {
    subscription,
    loading,
    canAddShop,
    canGenerateProduct,
    incrementProductGeneration,
    upgradePlan,
    refreshSubscription,
    isTrialActive,
    daysLeftInTrial,
    acceptTrial,
    isAccessBlocked,
    daysLeftInGracePeriod,
  }

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  )
}

export function useSubscription() {
  const context = useContext(SubscriptionContext)
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider')
  }
  return context
}

export { PLAN_LIMITS }



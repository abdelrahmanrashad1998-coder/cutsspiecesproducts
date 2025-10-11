'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Gift, Check, Crown, Mail, Loader2, AlertCircle, Lock, Clock } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useSubscription } from '@/contexts/SubscriptionContext'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { sendEmailVerification } from 'firebase/auth'

export function SubscriptionOnboardingModal() {
  const { firebaseUser } = useAuth()
  const { subscription, acceptTrial, daysLeftInGracePeriod, upgradePlan } = useSubscription()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [sendingVerification, setSendingVerification] = useState(false)
  const [accepting, setAccepting] = useState(false)
  const [upgrading, setUpgrading] = useState<'basic' | 'premium' | null>(null)

  useEffect(() => {
    // Show modal if user hasn't accepted trial yet
    // This is MANDATORY and BLOCKING
    if (firebaseUser && subscription) {
      const shouldShow = !subscription.trialAccepted
      setOpen(shouldShow)
    }
  }, [firebaseUser, subscription])

  // Force modal to be visible if trial not accepted
  useEffect(() => {
    if (subscription && !subscription.trialAccepted) {
      setOpen(true)
    }
  }, [subscription])

  const handleSendVerification = async () => {
    if (!firebaseUser) return

    setSendingVerification(true)
    try {
      await sendEmailVerification(firebaseUser)
      toast.success('✅ Verification email sent! Please check your inbox and spam folder.')
    } catch (error: any) {
      console.error('Error sending verification email:', error)
      if (error.code === 'auth/too-many-requests') {
        toast.error('Too many attempts. Please wait a few minutes before trying again.')
      } else {
        toast.error('Failed to send verification email. Please try again.')
      }
    } finally {
      setSendingVerification(false)
    }
  }

  const handleAcceptAndContinue = async () => {
    setAccepting(true)
    try {
      await acceptTrial()
      toast.success('✅ Trial accepted! Welcome aboard!')
      setOpen(false)
    } catch (error) {
      console.error('Error accepting trial:', error)
      toast.error('Failed to accept trial. Please try again.')
    } finally {
      setAccepting(false)
    }
  }

  const handleUpgrade = async (plan: 'basic' | 'premium') => {
    setUpgrading(plan)
    try {
      await upgradePlan(plan)
      toast.success(`🎉 Successfully upgraded to ${plan.charAt(0).toUpperCase() + plan.slice(1)} plan!`)
      // Modal will close automatically because subscription.trialAccepted becomes true
    } catch (error) {
      console.error('Error upgrading plan:', error)
      toast.error('Failed to upgrade plan. Please try again.')
    } finally {
      setUpgrading(null)
    }
  }

  if (!subscription) return null

  const gracePeriodDays = daysLeftInGracePeriod()

  // If trial not accepted, show DIRECT blocking modal (not using Dialog component)
  if (!subscription.trialAccepted) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[700px] max-h-[90vh] overflow-y-auto m-4 border-2 border-blue-200">
          {/* Header - Friendly Welcome */}
          <div className="relative p-8 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-t-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-white/20 rounded-full p-3">
                <Gift className="h-8 w-8" />
              </div>
              <div>
                <h2 className="text-3xl font-bold">Welcome to Your Free Trial! 🎉</h2>
                <p className="text-blue-100 text-sm mt-1">Let's get you started in just a moment</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="space-y-6 p-8">
          {/* Plan Comparison */}
          <div>
            <h3 className="text-xl font-bold text-gray-900 mb-4 text-center">Choose Your Plan</h3>
            <div className="grid md:grid-cols-3 gap-4">
              {/* Free Trial */}
              <div className="relative bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-5 border-2 border-blue-400 shadow-lg">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-blue-600 text-white px-3 py-1">🎁 Recommended</Badge>
                </div>
                <div className="text-center mt-2 mb-4">
                  <div className="inline-flex items-center justify-center bg-blue-100 rounded-full p-3 mb-2">
                    <Gift className="h-6 w-6 text-blue-600" />
                  </div>
                  <h4 className="font-bold text-lg text-gray-900">Free Trial</h4>
                  <div className="text-3xl font-bold text-blue-600 my-2">FREE</div>
                  <p className="text-xs text-gray-600">for 2 months</p>
                </div>
                <div className="space-y-2 mb-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                    <span><strong>1</strong> shop</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                    <span><strong>20</strong> products/mo</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                    <span>AI descriptions</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                    <span>Image analysis</span>
                  </div>
                </div>
                <Button
                  onClick={handleAcceptAndContinue}
                  disabled={accepting}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                >
                  {accepting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>Start Free Trial 🚀</>
                  )}
                </Button>
              </div>

              {/* Basic Plan */}
              <div className="bg-white rounded-xl p-5 border border-gray-200 hover:border-purple-300 hover:shadow-md transition-all">
                <div className="text-center mb-4">
                  <div className="inline-flex items-center justify-center bg-purple-100 rounded-full p-3 mb-2">
                    <Check className="h-6 w-6 text-purple-600" />
                  </div>
                  <h4 className="font-bold text-lg text-gray-900">Basic</h4>
                  <div className="text-3xl font-bold text-purple-600 my-2">500 EGP</div>
                  <p className="text-xs text-gray-600">per month</p>
                </div>
                <div className="space-y-2 mb-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                    <span><strong>2</strong> shops</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                    <span><strong>50</strong> products/mo</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                    <span>AI descriptions</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                    <span>Image analysis</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                    <span>Priority support</span>
                  </div>
                </div>
                <Button
                  onClick={() => handleUpgrade('basic')}
                  disabled={upgrading !== null}
                  variant="outline"
                  className="w-full border-purple-600 text-purple-700 hover:bg-purple-50"
                >
                  {upgrading === 'basic' ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Upgrading...
                    </>
                  ) : (
                    'Choose Basic'
                  )}
                </Button>
              </div>

              {/* Premium Plan */}
              <div className="bg-white rounded-xl p-5 border border-gray-200 hover:border-yellow-400 hover:shadow-md transition-all">
                <div className="text-center mb-4">
                  <div className="inline-flex items-center justify-center bg-yellow-100 rounded-full p-3 mb-2">
                    <Crown className="h-6 w-6 text-yellow-600" />
                  </div>
                  <h4 className="font-bold text-lg text-gray-900">Premium</h4>
                  <div className="text-3xl font-bold text-yellow-600 my-2">750 EGP</div>
                  <p className="text-xs text-gray-600">per month</p>
                </div>
                <div className="space-y-2 mb-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                    <span><strong>Unlimited</strong> shops</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                    <span><strong>Unlimited</strong> products</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                    <span>AI descriptions</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                    <span>Image analysis</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                    <span>Priority support</span>
                  </div>
                </div>
                <Button
                  onClick={() => handleUpgrade('premium')}
                  disabled={upgrading !== null}
                  variant="outline"
                  className="w-full border-yellow-600 text-yellow-700 hover:bg-yellow-50"
                >
                  {upgrading === 'premium' ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Upgrading...
                    </>
                  ) : (
                    <>
                      <Crown className="mr-2 h-4 w-4" />
                      Choose Premium
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Email Verification - Only show if not verified */}
          {!firebaseUser?.emailVerified && (
            <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
              <div className="flex items-start gap-3">
                <div className="bg-blue-100 rounded-full p-2">
                  <Mail className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-gray-900 mb-2">📧 One More Thing...</h4>
                  <p className="text-sm text-gray-700 mb-3">
                    Please verify your email within <strong className="text-blue-600">{gracePeriodDays} days</strong> to keep using the platform after accepting the trial.
                  </p>
                  <p className="text-sm text-gray-600 mb-3 bg-white rounded-lg p-2">
                    ✉️ <strong>{firebaseUser?.email}</strong>
                  </p>
                  <Button
                    onClick={handleSendVerification}
                    disabled={sendingVerification}
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {sendingVerification ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Mail className="mr-2 h-4 w-4" />
                        Send Verification Email Now
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-gray-500 mt-2">
                    Check your inbox and spam folder after sending!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Email Verified Confirmation */}
          {firebaseUser?.emailVerified && (
            <div className="bg-green-50 rounded-xl p-4 border border-green-200">
              <div className="flex items-center gap-3 justify-center">
                <div className="bg-green-100 rounded-full p-2">
                  <Check className="h-5 w-5 text-green-600" />
                </div>
                <p className="text-sm text-green-800 font-semibold">
                  ✅ Email verified! You're ready to go.
                </p>
              </div>
            </div>
          )}

          </div>

          {/* Footer - Simple note */}
          <div className="bg-gray-50 p-4 rounded-b-2xl border-t text-center">
            <p className="text-xs text-gray-500">
              By choosing a plan, you agree to our terms of service
            </p>
        </div>
      </div>
    </div>
    )
  }

  // If trial accepted, don't render anything
  return null
}


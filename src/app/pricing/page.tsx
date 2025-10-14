'use client'

import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useSubscription, PLAN_LIMITS, SubscriptionPlan } from '@/contexts/SubscriptionContext'
import { Check, Zap, Crown, Gift } from 'lucide-react'
import { toast } from 'sonner'
import { useState } from 'react'

export default function PricingPage() {
  const { subscription, loading, upgradePlan, isTrialActive, daysLeftInTrial } = useSubscription()
  const [upgrading, setUpgrading] = useState<SubscriptionPlan | null>(null)

  const handleUpgrade = async (plan: SubscriptionPlan) => {
    setUpgrading(plan)
    try {
      await upgradePlan(plan)
      toast.success(`Successfully upgraded to ${plan.charAt(0).toUpperCase() + plan.slice(1)} plan!`)
    } catch (error) {
      toast.error('Failed to upgrade plan. Please try again.')
    } finally {
      setUpgrading(null)
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      </DashboardLayout>
    )
  }

  const plans = [
    {
      id: 'free' as SubscriptionPlan,
      name: 'Free Trial',
      price: 0,
      period: '2 months',
      icon: Gift,
      description: 'Perfect for getting started',
      features: [
        'Manage 1 shop',
        '20 product generations/month',
        'AI-powered product descriptions',
        'Image analysis',
        'Collection management',
        '2 months free access',
      ],
      cta: 'Current Plan',
      highlight: false,
    },
    {
      id: 'basic' as SubscriptionPlan,
      name: 'Basic',
      price: 500,
      period: 'month',
      icon: Zap,
      description: 'Great for small businesses',
      features: [
        'Manage up to 2 shops',
        '50 product generations/month',
        'AI-powered product descriptions',
        'Image analysis',
        'Collection management',
        'Priority support',
      ],
      cta: 'Upgrade to Basic',
      highlight: false,
    },
    {
      id: 'premium' as SubscriptionPlan,
      name: 'Premium',
      price: 750,
      period: 'month',
      icon: Crown,
      description: 'For growing businesses',
      features: [
        'Unlimited shops',
        'Unlimited product generations',
        'AI-powered product descriptions',
        'Image analysis',
        'Collection management',
        'Priority support',
        'Advanced analytics (coming soon)',
      ],
      cta: 'Upgrade to Premium',
      highlight: true,
    },
  ]

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="text-center space-y-3 sm:space-y-4">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-[#245468]">Choose Your Plan</h1>
          <p className="text-base sm:text-lg md:text-xl text-gray-600 px-4">
            Select the perfect plan for your business needs
          </p>
          
          {/* Trial Status */}
          {isTrialActive() && (
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-[#245468]/10 to-[#fc8a2c]/10 border-2 border-[#245468]/30 rounded-full px-4 sm:px-6 py-2 sm:py-3 mx-4">
              <Gift className="h-4 sm:h-5 w-4 sm:w-5 text-[#fc8a2c] flex-shrink-0" />
              <span className="font-semibold text-[#245468] text-sm sm:text-base">
                {daysLeftInTrial()} days left in your free trial
              </span>
            </div>
          )}

          {subscription?.status === 'expired' && (
            <div className="inline-flex items-center gap-2 bg-red-50 border-2 border-red-400 rounded-full px-4 sm:px-6 py-2 sm:py-3 mx-4">
              <span className="font-semibold text-red-900 text-sm sm:text-base text-center">
                Your trial has expired. Please upgrade to continue using the platform.
              </span>
            </div>
          )}
        </div>

        {/* Current Subscription Info */}
        {subscription && (
          <Card className="bg-gradient-to-r from-[#245468]/5 to-[#fc8a2c]/5 border-2 border-[#245468]/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#245468]">
                Current Subscription
                {subscription.status === 'trial' && (
                  <Badge variant="secondary" className="bg-[#fc8a2c] text-white">Trial</Badge>
                )}
                {subscription.status === 'active' && (
                  <Badge variant="secondary" className="bg-[#245468] text-white">Active</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Plan</p>
                <p className="text-base sm:text-lg font-semibold capitalize">{subscription.plan}</p>
              </div>
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Products Generated</p>
                <p className="text-base sm:text-lg font-semibold">
                  {subscription.monthlyProductGenerations}
                  {subscription.maxMonthlyProducts !== 'unlimited' && ` / ${subscription.maxMonthlyProducts}`}
                  {subscription.maxMonthlyProducts === 'unlimited' && ' (Unlimited)'}
                </p>
              </div>
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Max Shops</p>
                <p className="text-base sm:text-lg font-semibold">
                  {subscription.maxShops === 999 ? 'Unlimited' : subscription.maxShops}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 px-4 sm:px-0">
          {plans.map((plan) => {
            const Icon = plan.icon
            const isCurrentPlan = subscription?.plan === plan.id
            const isDisabled = isCurrentPlan || upgrading !== null

            return (
              <Card 
                key={plan.id}
                className={`relative ${plan.highlight ? 'border-2 border-[#fc8a2c] shadow-xl' : 'border-2 border-[#245468]/20'}`}
              >
                {plan.highlight && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <Badge className="bg-[#fc8a2c] text-white px-4 py-1 shadow-lg">
                      Most Popular
                    </Badge>
                  </div>
                )}
                
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <Icon className={`h-6 sm:h-8 w-6 sm:w-8 ${plan.highlight ? 'text-[#fc8a2c]' : 'text-[#245468]'}`} />
                    {isCurrentPlan && (
                      <Badge variant="secondary" className="bg-[#245468] text-white text-xs">
                        Current
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-xl sm:text-2xl">{plan.name}</CardTitle>
                  <CardDescription className="text-sm">{plan.description}</CardDescription>
                  <div className="pt-3 sm:pt-4">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl sm:text-4xl font-bold">{plan.price}</span>
                      <span className="text-lg sm:text-xl font-semibold">EGP</span>
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground">per {plan.period}</p>
                  </div>
                </CardHeader>

                <CardContent className="pb-4">
                  <ul className="space-y-2 sm:space-y-3">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <Check className="h-4 sm:h-5 w-4 sm:w-5 text-[#245468] flex-shrink-0 mt-0.5" />
                        <span className="text-xs sm:text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>

                <CardFooter className="pt-4">
                  <Button
                    className="w-full text-sm sm:text-base"
                    variant={plan.highlight ? 'default' : 'outline'}
                    disabled={isDisabled}
                    onClick={() => !isCurrentPlan && handleUpgrade(plan.id)}
                  >
                    {upgrading === plan.id && 'Processing...'}
                    {upgrading !== plan.id && (isCurrentPlan ? 'Current Plan' : plan.cta)}
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>

        {/* Additional Info */}
        <Card className="mx-4 sm:mx-0">
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">Frequently Asked Questions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2 text-sm sm:text-base">What happens after my trial ends?</h4>
              <p className="text-xs sm:text-sm text-muted-foreground">
                After your 2-month free trial, you'll need to upgrade to a paid plan to continue using the platform. 
                Your data will be preserved, and you can choose the plan that best fits your needs.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2 text-sm sm:text-base">Can I change plans later?</h4>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Yes! You can upgrade or downgrade your plan at any time. Changes will take effect immediately.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2 text-sm sm:text-base">What counts as a product generation?</h4>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Each time you use our AI to analyze images and generate product descriptions, it counts as one product generation. 
                The counter resets monthly.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2 text-sm sm:text-base">How do I pay?</h4>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Contact our support team to set up payment. We accept various payment methods including bank transfers and credit cards.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}



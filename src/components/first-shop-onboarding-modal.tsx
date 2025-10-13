'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Store, ArrowRight, CheckCircle, Sparkles, Loader2, ExternalLink, TestTube, XCircle } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useSubscription } from '@/contexts/SubscriptionContext'
import { useRouter, usePathname } from 'next/navigation'
import { toast } from 'sonner'

export function FirstShopOnboardingModal() {
  const { user, firebaseUser } = useAuth()
  const { subscription } = useSubscription()
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [shops, setShops] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState<'welcome' | 'form'>('welcome')
  
  // Form states
  const [shopifyDomain, setShopifyDomain] = useState('')
  const [shopifyAccessToken, setShopifyAccessToken] = useState('')
  const [shopName, setShopName] = useState('')
  const [shopEmail, setShopEmail] = useState('')
  const [storeDescription, setStoreDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [connectionTest, setConnectionTest] = useState<any>(null)

  useEffect(() => {
    // Only check shops if trial is already accepted
    if (firebaseUser && subscription?.trialAccepted) {
      checkShops()
    }
  }, [firebaseUser, subscription?.trialAccepted, pathname])

  const checkShops = async () => {
    if (!firebaseUser) return

    setLoading(true)
    try {
      const token = await firebaseUser.getIdToken()
      const response = await fetch('/api/shops', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      
      if (response.ok) {
        const data = await response.json()
        setShops(data.shops || [])
        
        // Show modal only if user has 0 shops and on dashboard
        if (data.shops.length === 0 && pathname === '/dashboard') {
          console.log('🏪 No shops found, showing first shop onboarding')
          // Small delay to let subscription modal close first
          setTimeout(() => setOpen(true), 500)
        } else {
          console.log('✅ User has shops or not on dashboard, skipping onboarding')
          setOpen(false)
        }
      }
    } catch (error) {
      console.error('Error fetching shops:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStartSetup = () => {
    setStep('form')
  }

  const testConnection = async () => {
    if (!shopifyDomain || !shopifyAccessToken) {
      toast.error('Please enter both domain and access token')
      return
    }

    setIsTesting(true)
    try {
      const response = await fetch('/api/shops/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shopifyDomain,
          shopifyAccessToken,
        }),
      })

      const data = await response.json()
      setConnectionTest(data)

      if (data.success) {
        toast.success('✅ Connection successful!')
        // Auto-fill shop info if available
        if (data.shopInfo) {
          setShopName(data.shopInfo.name)
          setShopEmail(data.shopInfo.email)
        }
      } else {
        toast.error(data.message || 'Connection failed')
      }
    } catch (error) {
      toast.error('Error testing connection')
    } finally {
      setIsTesting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!firebaseUser) return

    setIsSubmitting(true)
    try {
      const token = await firebaseUser.getIdToken()
      
      const response = await fetch('/api/shops', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          shopifyDomain,
          shopifyAccessToken,
          shopName,
          shopEmail,
          storeDescription,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('🎉 Shop connected successfully!')
        setOpen(false)
        // Refresh to update shop list
        window.location.reload()
      } else {
        toast.error(data.error || 'Failed to connect shop')
      }
    } catch (error) {
      toast.error('Error connecting shop')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSkipForNow = () => {
    setOpen(false)
    toast.info('You can connect your shop anytime from "Manage Shops" in the sidebar')
  }

  // Don't show if:
  // 1. Trial not accepted yet (subscription modal is showing)
  // 2. User is already on connect-shop page
  // 3. User is on pricing page
  if (!subscription?.trialAccepted || loading || !open) return null
  if (pathname === '/connect-shop' || pathname === '/pricing') return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-[#245468]/10 via-[#fc8a2c]/10 to-[#245468]/20 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[800px] max-h-[90vh] overflow-y-auto border-2 border-[#245468]/20">
        {/* Header - Enterprise Welcoming */}
        <div className="relative p-8 bg-gradient-to-r from-[#245468] to-[#1a3d4d] text-white rounded-t-2xl">
          <div className="flex items-center gap-4 mb-3">
            <div className="relative">
              <div className="absolute inset-0 bg-[#fc8a2c] blur-xl opacity-50 rounded-full"></div>
              <div className="relative bg-white/10 rounded-full p-3 backdrop-blur-sm">
                <Store className="h-8 w-8 text-[#fc8a2c]" />
              </div>
            </div>
            <div>
              <h2 className="text-3xl font-bold tracking-tight">
                {step === 'welcome' ? "Let's Get Started! 🚀" : "Connect Your Shop 🏪"}
              </h2>
              <p className="text-white/80 text-sm mt-1">
                {step === 'welcome' ? 'Connect your first Shopify store' : 'Step 1 of 1 - Quick Setup'}
              </p>
            </div>
          </div>
        </div>

        {/* Content - Welcome Screen */}
        {step === 'welcome' && (
          <div className="p-8 space-y-6">
          <div className="text-center">
            <div className="relative inline-flex items-center justify-center mb-4">
              <div className="absolute inset-0 bg-[#fc8a2c] blur-2xl opacity-30 rounded-full"></div>
              <div className="relative bg-[#245468] rounded-full p-4">
                <Store className="h-12 w-12 text-[#fc8a2c]" />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-[#245468] mb-2">
              You're all set! Now let's connect your store
            </h3>
            <p className="text-gray-600 mb-6">
              To start generating AI-powered product descriptions, you need to connect your Shopify store first.
            </p>
          </div>

          {/* Benefits Preview */}
          <div className="bg-gradient-to-br from-[#245468]/5 to-[#fc8a2c]/5 rounded-xl p-6 border-2 border-[#245468]/20">
            <h4 className="font-bold text-[#245468] mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[#fc8a2c]" />
              What you can do after connecting:
            </h4>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="bg-[#245468] rounded-full p-1.5">
                  <CheckCircle className="h-4 w-4 text-white" />
                </div>
                <span className="text-sm text-gray-700">Upload product images and get AI descriptions</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="bg-[#245468] rounded-full p-1.5">
                  <CheckCircle className="h-4 w-4 text-white" />
                </div>
                <span className="text-sm text-gray-700">Organize products into collections</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="bg-[#245468] rounded-full p-1.5">
                  <CheckCircle className="h-4 w-4 text-white" />
                </div>
                <span className="text-sm text-gray-700">Generate 20 products per month with AI</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="bg-[#245468] rounded-full p-1.5">
                  <CheckCircle className="h-4 w-4 text-white" />
                </div>
                <span className="text-sm text-gray-700">Sync directly with your Shopify store</span>
              </div>
            </div>
          </div>

          {/* Quick Guide */}
          <div className="bg-[#245468]/5 rounded-xl p-5 border border-[#245468]/20">
            <h4 className="font-semibold text-[#245468] mb-3 text-sm">Quick Setup (2 minutes):</h4>
            <ol className="space-y-2 text-xs text-gray-700">
              <li className="flex gap-2">
                <span className="font-bold text-[#fc8a2c]">1.</span>
                <span>Get your Shopify store URL (e.g., yourstore.myshopify.com)</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-[#fc8a2c]">2.</span>
                <span>Create a private app in your Shopify admin to get API access token</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-[#fc8a2c]">3.</span>
                <span>Connect your store and start generating products!</span>
              </li>
            </ol>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button
              onClick={handleStartSetup}
              className="w-full bg-[#fc8a2c] hover:bg-[#e07b27] text-white text-lg py-6 shadow-lg hover:shadow-xl transition-all"
              size="lg"
            >
              <Store className="mr-2 h-5 w-5" />
              Connect My First Shop
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            
            <Button
              onClick={handleSkipForNow}
              variant="outline"
              className="w-full border-2 border-[#245468]/30 text-[#245468] hover:bg-[#245468]/5"
            >
              I'll do this later
            </Button>
          </div>

          <p className="text-xs text-center text-gray-500">
            You can always connect your shop later from the sidebar menu
          </p>
          </div>
        )}

        {/* Content - Form Screen */}
        {step === 'form' && (
          <form onSubmit={handleSubmit} className="p-8 space-y-6">
            {/* Form Fields */}
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="shopifyDomain">Store Domain *</Label>
                  <Input
                    id="shopifyDomain"
                    type="text"
                    placeholder="yourstore.myshopify.com"
                    value={shopifyDomain}
                    onChange={(e) => setShopifyDomain(e.target.value)}
                    required
                  />
                  <p className="text-xs text-gray-500">
                    Your myshopify.com domain
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="shopifyAccessToken">Access Token *</Label>
                  <Input
                    id="shopifyAccessToken"
                    type="password"
                    placeholder="shpat_xxxxx"
                    value={shopifyAccessToken}
                    onChange={(e) => setShopifyAccessToken(e.target.value)}
                    required
                  />
                  <p className="text-xs text-gray-500">
                    Admin API access token
                  </p>
                </div>
              </div>

              {/* Test Connection Button */}
              <Button
                type="button"
                variant="outline"
                onClick={testConnection}
                disabled={isTesting || !shopifyDomain || !shopifyAccessToken}
                className="w-full"
              >
                {isTesting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Testing Connection...
                  </>
                ) : (
                  <>
                    <TestTube className="mr-2 h-4 w-4" />
                    Test Connection
                  </>
                )}
              </Button>

              {/* Connection Test Results */}
              {connectionTest && (
                <div className={`p-4 rounded-lg border-2 ${
                  connectionTest.success 
                    ? 'bg-[#245468]/5 border-[#245468]' 
                    : 'bg-red-50 border-red-400'
                }`}>
                  <div className="flex items-center space-x-2">
                    {connectionTest.success ? (
                      <CheckCircle className="h-5 w-5 text-[#245468]" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                    <span className={`text-sm font-medium ${
                      connectionTest.success ? 'text-[#245468]' : 'text-red-800'
                    }`}>
                      {connectionTest.message}
                    </span>
                  </div>
                  
                  {connectionTest.shopInfo && (
                    <div className="mt-3 text-xs text-[#245468] space-y-1 bg-white p-3 rounded-lg border border-[#245468]/20">
                      <p><strong>Shop:</strong> {connectionTest.shopInfo.name}</p>
                      <p><strong>Email:</strong> {connectionTest.shopInfo.email}</p>
                      <p><strong>Currency:</strong> {connectionTest.shopInfo.currency}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Optional Fields */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="shopName">Shop Name (Optional)</Label>
                  <Input
                    id="shopName"
                    type="text"
                    placeholder="My Awesome Store"
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="shopEmail">Shop Email (Optional)</Label>
                  <Input
                    id="shopEmail"
                    type="email"
                    placeholder="admin@store.com"
                    value={shopEmail}
                    onChange={(e) => setShopEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="storeDescription">Store Description (Optional)</Label>
                <Textarea
                  id="storeDescription"
                  placeholder="Describe your store's brand and style to help AI generate better descriptions..."
                  value={storeDescription}
                  onChange={(e) => setStoreDescription(e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            {/* How to Get Token */}
            <div className="bg-[#245468]/5 rounded-xl p-5 border-2 border-[#245468]/20">
              <h4 className="font-semibold text-sm text-[#245468] mb-3">📖 How to get your Access Token:</h4>
              <ol className="text-xs text-gray-700 space-y-1.5 list-decimal list-inside">
                <li>Go to your Shopify admin panel</li>
                <li>Navigate to: Apps → App and sales channel settings</li>
                <li>Click "Develop apps" → "Create an app"</li>
                <li>Configure Admin API permissions</li>
                <li>Install the app and copy the access token</li>
              </ol>
              <Button
                type="button"
                variant="link"
                size="sm"
                className="mt-3 p-0 h-auto text-[#fc8a2c] hover:text-[#e07b27]"
                onClick={() => window.open('https://help.shopify.com/en/manual/apps/app-types/custom-apps', '_blank')}
              >
                <ExternalLink className="mr-1 h-3 w-3" />
                Learn More
              </Button>
            </div>

            {/* Submit Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep('welcome')}
                className="flex-1 border-2 border-[#245468]/30 text-[#245468] hover:bg-[#245468]/5"
              >
                Back
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !connectionTest?.success}
                className="flex-1 bg-[#fc8a2c] hover:bg-[#e07b27] text-white shadow-lg hover:shadow-xl transition-all"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Connect Shop
                  </>
                )}
              </Button>
            </div>

            <p className="text-xs text-center text-gray-500">
              Test your connection first to ensure everything works correctly
            </p>
          </form>
        )}
      </div>
    </div>
  )
}


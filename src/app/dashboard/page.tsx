'use client'

import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Button } from '@/components/ui/button'
import { ShopDropdown } from '@/components/shop-dropdown'
import { ProductsDisplay } from '@/components/products-display'
import { CollectionsDisplay } from '@/components/collections-display'
import { Plus, Store, Crown, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { useSubscription } from '@/contexts/SubscriptionContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function DashboardPage() {
  const { user, selectedShop, setSelectedShop } = useAuth()
  const { subscription, isTrialActive, daysLeftInTrial } = useSubscription()

  if (!user) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-4 border-[#fc8a2c]"></div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Subscription Alert */}
        {subscription?.status === 'expired' && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="flex flex-col sm:flex-row items-start sm:items-center gap-4 py-4">
              <AlertCircle className="h-8 w-8 text-red-600 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-red-900">Your trial has expired</h3>
                <p className="text-sm text-red-700">Upgrade to a paid plan to continue using the platform.</p>
              </div>
              <Link href="/pricing" className="w-full sm:w-auto">
                <Button variant="default" className="w-full sm:w-auto bg-red-600 hover:bg-red-700">
                  <Crown className="mr-2 h-4 w-4" />
                  View Plans
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Trial Warning */}
        {isTrialActive() && daysLeftInTrial() <= 7 && (
          <Card className="border-2 border-[#fc8a2c]/50 bg-[#fc8a2c]/5">
            <CardContent className="flex flex-col sm:flex-row items-start sm:items-center gap-4 py-4">
              <AlertCircle className="h-8 w-8 text-[#fc8a2c] flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-[#245468]">Trial ending soon</h3>
                <p className="text-sm text-gray-700">
                  You have {daysLeftInTrial()} days left in your free trial. Upgrade now to continue without interruption.
                </p>
              </div>
              <Link href="/pricing" className="w-full sm:w-auto">
                <Button variant="outline" className="w-full sm:w-auto border-2 border-[#fc8a2c] text-[#fc8a2c] hover:bg-[#fc8a2c] hover:text-white">
                  <Crown className="mr-2 h-4 w-4" />
                  View Plans
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Header Section */}
        <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#245468]">Dashboard</h1>
            <p className="text-sm sm:text-base text-gray-600">
              Manage your Shopify stores, products, and collections
            </p>
          </div>
          <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2">
            <Link href="/add-product" className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                Add Product
              </Button>
            </Link>
            <Link href="/connect-shop" className="w-full sm:w-auto">
              <Button variant="outline" className="w-full sm:w-auto">
                <Store className="mr-2 h-4 w-4" />
                Manage Shops
              </Button>
            </Link>
          </div>
        </div>

        {/* Subscription Stats */}
        {subscription && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Current Plan</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <p className="text-xl sm:text-2xl font-bold capitalize text-[#245468]">{subscription.plan}</p>
                  {subscription.status === 'trial' && (
                    <Badge variant="secondary" className="bg-[#fc8a2c] text-white text-xs">Trial</Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Products This Month</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl sm:text-2xl font-bold">
                  {subscription.monthlyProductGenerations}
                  {subscription.maxMonthlyProducts !== 'unlimited' && (
                    <span className="text-sm sm:text-base font-normal text-muted-foreground"> / {subscription.maxMonthlyProducts}</span>
                  )}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Max Shops</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl sm:text-2xl font-bold">
                  {subscription.maxShops === 999 ? 'Unlimited' : subscription.maxShops}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {isTrialActive() ? 'Trial Days Left' : 'Status'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl sm:text-2xl font-bold text-[#245468]">
                  {isTrialActive() ? daysLeftInTrial() : (
                    <Badge className="bg-[#245468] text-white">Active</Badge>
                  )}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Shop Selection */}
        <div className="rounded-lg border bg-card p-6">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">Selected Store</h2>
            <ShopDropdown 
              selectedShop={selectedShop} 
              onShopSelect={setSelectedShop} 
            />
          </div>
        </div>

        {/* Content Grid */}
        <div className="space-y-8">
          {/* Products Display */}
          <ProductsDisplay selectedShop={selectedShop} />

          {/* Collections Display */}
          <CollectionsDisplay selectedShop={selectedShop} />
        </div>
      </div>
    </DashboardLayout>
  )
}

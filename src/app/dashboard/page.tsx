'use client'

import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Button } from '@/components/ui/button'
import { ShopDropdown } from '@/components/shop-dropdown'
import { ProductsDisplay } from '@/components/products-display'
import { CollectionsDisplay } from '@/components/collections-display'
import { Plus, Store } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'

export default function DashboardPage() {
  const { user, selectedShop, setSelectedShop } = useAuth()

  if (!user) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header Section */}
        <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
          <div className="space-y-1">
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-sm lg:text-base text-muted-foreground">
              Manage your Shopify stores, products, and collections
            </p>
          </div>
          <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2">
            <Link href="/add-product">
              <Button className="w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                Add Product
              </Button>
            </Link>
            <Link href="/connect-shop">
              <Button variant="outline" className="w-full sm:w-auto">
                <Store className="mr-2 h-4 w-4" />
                Manage Shops
              </Button>
            </Link>
          </div>
        </div>

        {/* Shop Selection */}
        <div className="rounded-lg border bg-card p-4 lg:p-6">
          <div className="space-y-2">
            <h2 className="text-base lg:text-lg font-semibold">Selected Store</h2>
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

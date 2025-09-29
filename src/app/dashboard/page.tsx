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
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600">Manage your Shopify stores, products, and collections</p>
          </div>
          <div className="flex space-x-2">
            <Link href="/add-product">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Product
              </Button>
            </Link>
            <Link href="/connect-shop">
              <Button variant="outline">
                <Store className="mr-2 h-4 w-4" />
                Manage Shops
              </Button>
            </Link>
          </div>
        </div>

        {/* Shop Selection */}
        <div className="bg-white p-4 rounded-lg border">
          <ShopDropdown 
            selectedShop={selectedShop} 
            onShopSelect={setSelectedShop} 
          />
        </div>

        {/* Products Display */}
        <ProductsDisplay selectedShop={selectedShop} />

        {/* Collections Display */}
        <CollectionsDisplay selectedShop={selectedShop} />
      </div>
    </DashboardLayout>
  )
}

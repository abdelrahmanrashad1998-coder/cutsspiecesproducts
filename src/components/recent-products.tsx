'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Package, Loader2, Clock, ExternalLink } from 'lucide-react'
import { useAuth, Shop } from '@/contexts/AuthContext'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface RecentProduct {
  id: string
  shopId: string
  shopifyId: string
  title: string
  description?: string
  price: number
  category?: string
  images: string[]
  createdAt: Date | string
}

interface RecentProductsProps {
  selectedShop?: Shop | null
  limit?: number
}

export function RecentProducts({ selectedShop, limit = 5 }: RecentProductsProps) {
  const [products, setProducts] = useState<RecentProduct[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user, firebaseUser, shops } = useAuth()

  useEffect(() => {
    if (user && firebaseUser) {
      fetchRecentProducts()
    }
  }, [user, firebaseUser, selectedShop])

  const fetchRecentProducts = async () => {
    if (!user || !firebaseUser) return

    setIsLoading(true)
    setError(null)

    try {
      const token = await firebaseUser.getIdToken()
      const params = new URLSearchParams({
        userId: user.id,
        limit: limit.toString(),
      })

      // If a shop is selected, filter by that shop
      if (selectedShop?.id) {
        params.append('shopId', selectedShop.id)
      }

      const response = await fetch(`/api/products/recent?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setProducts(data.products || [])
        
        // Log warning if using fallback query
        if (data.warning) {
          console.warn('Recent products:', data.warning)
        }
      } else {
        const errorData = await response.json()
        const errorMessage = errorData.details 
          ? `${errorData.error}: ${errorData.details}` 
          : errorData.error || 'Failed to fetch recent products'
        setError(errorMessage)
        console.error('Error fetching recent products:', errorData)
      }
    } catch (error) {
      console.error('Error fetching recent products:', error)
      setError(error instanceof Error ? error.message : 'Error fetching recent products')
    } finally {
      setIsLoading(false)
    }
  }

  const formatTimeAgo = (date: Date | string) => {
    const now = new Date()
    const productDate = new Date(date)
    const diffInMs = now.getTime() - productDate.getTime()
    const diffInMinutes = Math.floor(diffInMs / 60000)
    const diffInHours = Math.floor(diffInMinutes / 60)
    const diffInDays = Math.floor(diffInHours / 24)

    if (diffInMinutes < 1) return 'Just now'
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`
    if (diffInHours < 24) return `${diffInHours}h ago`
    if (diffInDays < 7) return `${diffInDays}d ago`
    return productDate.toLocaleDateString()
  }

  const getShopForProduct = (shopId: string) => {
    return shops?.find(shop => shop.id === shopId)
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center space-x-2">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-xl">Recently Added Products</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading recent products...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center space-x-2">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-xl">Recently Added Products</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-red-500">
            <Package className="mx-auto h-12 w-12 text-red-400 mb-4" />
            <p>{error}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-xl">Recently Added Products</CardTitle>
            {products.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {products.length}
              </Badge>
            )}
          </div>
          {products.length > 0 && (
            <Link href="/add-product">
              <Button variant="outline" size="sm">
                Add More
              </Button>
            </Link>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {products.length === 0 ? (
          <div className="text-center py-12">
            <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground mb-2">
              No products yet
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Add your first product to get started.
            </p>
            <Link href="/add-product">
              <Button>Add Product</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {products.map((product) => {
              const shop = getShopForProduct(product.shopId)
              const imageUrl = product.images && product.images.length > 0 
                ? (typeof product.images[0] === 'string' ? product.images[0] : product.images[0])
                : null

              return (
                <div
                  key={product.id}
                  className="flex items-center space-x-4 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors group"
                >
                  {/* Product Image */}
                  <div className="flex-shrink-0">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={product.title}
                        className="h-16 w-16 object-cover rounded-lg border"
                      />
                    ) : (
                      <div className="h-16 w-16 bg-muted rounded-lg flex items-center justify-center border">
                        <Package className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h4 className="font-medium text-sm leading-tight truncate">
                          {product.title}
                        </h4>
                        {shop && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {shop.shopName || shop.shopifyDomain}
                          </p>
                        )}
                        {product.category && (
                          <Badge variant="outline" className="text-xs mt-1">
                            {product.category}
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <p className="font-semibold text-sm">
                          {formatCurrency(product.price, shop?.currency || 'USD')}
                        </p>
                        <p className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatTimeAgo(product.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  {shop && (
                    <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          // Try to construct the product URL - we'll need the handle from Shopify
                          // For now, just open the shop
                          window.open(`https://${shop.shopifyDomain}`, '_blank')
                        }}
                        title="View on store"
                        className="h-8 w-8 p-0"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}


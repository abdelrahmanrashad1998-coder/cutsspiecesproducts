'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { 
  Store, 
  CheckCircle, 
  XCircle, 
  Loader2,
  ChevronDown,
  Settings
} from 'lucide-react'
import { useAuth, Shop } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import Link from 'next/link'

interface ShopDropdownProps {
  selectedShop: Shop | null
  onShopSelect: (shop: Shop | null) => void
}

export function ShopDropdown({ selectedShop, onShopSelect }: ShopDropdownProps) {
  const [shops, setShops] = useState<Shop[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [testingConnection, setTestingConnection] = useState<string | null>(null)
  const { firebaseUser } = useAuth()

  useEffect(() => {
    if (firebaseUser) {
      fetchShops()
    }
  }, [firebaseUser])

  const fetchShops = async () => {
    if (!firebaseUser) return

    try {
      const token = await firebaseUser.getIdToken()
      
      const response = await fetch('/api/shops', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      
      if (response.ok) {
        const data = await response.json()
        setShops(data.shops)
      } else {
        toast.error('Failed to fetch shops')
      }
    } catch (error) {
      toast.error('Error fetching shops')
    } finally {
      setIsLoading(false)
    }
  }

  const handleShopSelect = async (shop: Shop) => {
    if (selectedShop?.id === shop.id) {
      // If already selected, deselect
      onShopSelect(null)
      return
    }

    setTestingConnection(shop.id)
    try {
      // Test the shop connection by fetching a small amount of data
      const token = await firebaseUser?.getIdToken()
      const response = await fetch(`/api/shops/${shop.id}/products?limit=1`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (response.ok) {
        onShopSelect(shop)
        toast.success(`Connected to ${shop.shopName || shop.shopifyDomain}`)
      } else {
        const errorData = await response.json()
        toast.error(`Failed to connect to shop: ${errorData.error || 'Unknown error'}`)
      }
    } catch (error) {
      toast.error('Error connecting to shop')
    } finally {
      setTestingConnection(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center space-x-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-gray-500">Loading shops...</span>
      </div>
    )
  }

  return (
    <div className="flex items-center space-x-4">
      <div className="flex items-center space-x-2">
        <Store className="h-4 w-4 text-gray-500" />
        <span className="text-sm font-medium">Shop:</span>
      </div>
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="min-w-[200px] justify-between">
            <div className="flex items-center space-x-2">
              {selectedShop ? (
                <>
                  <span className="truncate">
                    {selectedShop.shopName || selectedShop.shopifyDomain}
                  </span>
                  {selectedShop.isActive ? (
                    <CheckCircle className="h-3 w-3 text-green-600 flex-shrink-0" />
                  ) : (
                    <XCircle className="h-3 w-3 text-red-600 flex-shrink-0" />
                  )}
                </>
              ) : (
                <span className="text-gray-500">Select a shop</span>
              )}
            </div>
            <ChevronDown className="h-4 w-4 ml-2" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-64">
          {shops.length === 0 ? (
            <DropdownMenuItem disabled>
              <div className="text-center py-2">
                <Store className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                <p className="text-sm text-gray-500">No shops connected</p>
                <Link href="/connect-shop">
                  <Button variant="outline" size="sm" className="mt-2">
                    <Store className="mr-2 h-3 w-3" />
                    Connect Shop
                  </Button>
                </Link>
              </div>
            </DropdownMenuItem>
          ) : (
            <>
              {shops.map((shop) => (
                <DropdownMenuItem
                  key={shop.id}
                  onClick={() => handleShopSelect(shop)}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center space-x-2">
                    <span className="truncate">
                      {shop.shopName || shop.shopifyDomain}
                    </span>
                    {testingConnection === shop.id ? (
                      <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
                    ) : shop.isActive ? (
                      <CheckCircle className="h-3 w-3 text-green-600" />
                    ) : (
                      <XCircle className="h-3 w-3 text-red-600" />
                    )}
                  </div>
                  {selectedShop?.id === shop.id && (
                    <Badge variant="default" className="ml-2">
                      Selected
                    </Badge>
                  )}
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem asChild>
                <Link href="/connect-shop" className="flex items-center">
                  <Settings className="mr-2 h-4 w-4" />
                  Manage Shops
                </Link>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      
      {selectedShop && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onShopSelect(null)}
        >
          Clear
        </Button>
      )}
    </div>
  )
}

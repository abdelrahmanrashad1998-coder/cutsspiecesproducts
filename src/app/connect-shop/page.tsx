'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAuth, Shop } from '@/contexts/AuthContext'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { toast } from 'sonner'
import { 
  Loader2, 
  Store, 
  ExternalLink, 
  CheckCircle, 
  XCircle, 
  TestTube, 
  Edit, 
  Trash2, 
  Plus,
  Settings,
  AlertCircle
} from 'lucide-react'

interface ConnectionTest {
  success: boolean
  message: string
  shopInfo?: {
    name: string
    domain: string
    email: string
    currency: string
    timezone: string
  }
  productsTest?: {
    success: boolean
    message: string
  }
}

export default function ManageShopsPage() {
  const [shops, setShops] = useState<Shop[]>([])
  const [isLoadingShops, setIsLoadingShops] = useState(true)
  const [editingShop, setEditingShop] = useState<Shop | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  
  // Form states
  const [shopifyDomain, setShopifyDomain] = useState('')
  const [shopifyAccessToken, setShopifyAccessToken] = useState('')
  const [shopName, setShopName] = useState('')
  const [shopEmail, setShopEmail] = useState('')
  const [storeDescription, setStoreDescription] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [connectionTest, setConnectionTest] = useState<ConnectionTest | null>(null)
  
  const { user, firebaseUser } = useAuth()
  const router = useRouter()

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
      setIsLoadingShops(false)
    }
  }

  const resetForm = () => {
    setShopifyDomain('')
    setShopifyAccessToken('')
    setShopName('')
    setShopEmail('')
    setStoreDescription('')
    setConnectionTest(null)
    setEditingShop(null)
    setShowAddForm(false)
  }

  const startEditing = (shop: Shop) => {
    setEditingShop(shop)
    setShopifyDomain(shop.shopifyDomain)
    setShopifyAccessToken('') // Don't pre-fill for security
    setShopName(shop.shopName || '')
    setShopEmail(shop.shopEmail || '')
    setStoreDescription(shop.storeDescription || '')
    setConnectionTest(null)
    setShowAddForm(true)
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
        toast.success('Connection test successful!')
        // Auto-fill shop info if available
        if (data.shopInfo) {
          setShopName(data.shopInfo.name)
          setShopEmail(data.shopInfo.email)
        }
      } else {
        toast.error(data.message || 'Connection test failed')
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

    setIsLoading(true)
    try {
      const token = await firebaseUser.getIdToken()
      
      const url = editingShop ? `/api/shops/${editingShop.id}` : '/api/shops'
      const method = editingShop ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
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
        toast.success(editingShop ? 'Shop updated successfully!' : 'Shop connected successfully!')
        resetForm()
        fetchShops()
      } else {
        toast.error(data.error || `Failed to ${editingShop ? 'update' : 'connect'} shop`)
      }
    } catch (error) {
      toast.error(`Error ${editingShop ? 'updating' : 'connecting'} shop`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteShop = async (shopId: string) => {
    if (!confirm('Are you sure you want to delete this shop? This action cannot be undone.')) {
      return
    }

    try {
      const token = await firebaseUser?.getIdToken()
      const response = await fetch(`/api/shops/${shopId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (response.ok) {
        toast.success('Shop deleted successfully')
        fetchShops()
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to delete shop')
      }
    } catch (error) {
      toast.error('Error deleting shop')
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header Section */}
        <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight flex items-center">
              <Settings className="mr-3 h-8 w-8" />
              Manage Shops
            </h1>
            <p className="text-muted-foreground">
              Connect, edit, and manage your Shopify stores
            </p>
          </div>
        </div>

        {/* Existing Shops */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center">
                <Store className="mr-2 h-5 w-5" />
                Connected Shops ({shops.length})
              </CardTitle>
              <Button onClick={() => setShowAddForm(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add New Shop
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingShops ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="ml-2">Loading shops...</span>
              </div>
            ) : shops.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Store className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p>No shops connected yet</p>
                <p className="text-sm">Add your first Shopify store to get started</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {shops.map((shop) => (
                  <div key={shop.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium">{shop.shopName || shop.shopifyDomain}</h3>
                      {shop.isActive ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600" />
                      )}
                    </div>
                    <p className="text-sm text-gray-600">{shop.shopifyDomain}</p>
                    {shop.shopEmail && (
                      <p className="text-sm text-gray-500">{shop.shopEmail}</p>
                    )}
                    <div className="mt-3 flex items-center justify-between">
                      <Badge variant={shop.isActive ? 'default' : 'secondary'}>
                        {shop.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startEditing(shop)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteShop(shop.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add/Edit Shop Form */}
        {showAddForm && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center">
                  {editingShop ? (
                    <>
                      <Edit className="mr-2 h-5 w-5" />
                      Edit Shop
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-5 w-5" />
                      Add New Shop
                    </>
                  )}
                </CardTitle>
                <Button variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
              <CardDescription>
                {editingShop 
                  ? 'Update your shop credentials and information'
                  : 'Connect a new Shopify store to your account'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="shopifyDomain">Shopify Store Domain</Label>
                    <Input
                      id="shopifyDomain"
                      type="text"
                      placeholder="your-store.myshopify.com"
                      value={shopifyDomain}
                      onChange={(e) => setShopifyDomain(e.target.value)}
                      required
                    />
                    <p className="text-xs text-gray-500">
                      Enter your store domain (e.g., mystore.myshopify.com)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="shopifyAccessToken">Admin API Access Token</Label>
                    <Input
                      id="shopifyAccessToken"
                      type="password"
                      placeholder={editingShop ? "Enter new token (leave blank to keep current)" : "Enter your access token"}
                      value={shopifyAccessToken}
                      onChange={(e) => setShopifyAccessToken(e.target.value)}
                      required={!editingShop}
                    />
                    <p className="text-xs text-gray-500">
                      {editingShop 
                        ? "Leave blank to keep current token"
                        : "Get this from your Shopify admin under Apps > App and sales channel settings"
                      }
                    </p>
                  </div>
                </div>

                {/* Test Connection Button */}
                <Button
                  type="button"
                  variant="outline"
                  onClick={testConnection}
                  disabled={isTesting || !shopifyDomain || (!shopifyAccessToken && !editingShop)}
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
                  <div className={`p-3 rounded-lg border ${
                    connectionTest.success 
                      ? 'bg-green-50 border-green-200' 
                      : 'bg-red-50 border-red-200'
                  }`}>
                    <div className="flex items-center space-x-2">
                      {connectionTest.success ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600" />
                      )}
                      <span className={`text-sm font-medium ${
                        connectionTest.success ? 'text-green-800' : 'text-red-800'
                      }`}>
                        {connectionTest.message}
                      </span>
                    </div>
                    
                    {connectionTest.shopInfo && (
                      <div className="mt-2 text-xs text-green-700">
                        <p><strong>Shop:</strong> {connectionTest.shopInfo.name}</p>
                        <p><strong>Email:</strong> {connectionTest.shopInfo.email}</p>
                        <p><strong>Currency:</strong> {connectionTest.shopInfo.currency}</p>
                      </div>
                    )}

                    {connectionTest.productsTest && (
                      <div className="mt-1 text-xs">
                        <span className={connectionTest.productsTest.success ? 'text-green-700' : 'text-red-700'}>
                          Products access: {connectionTest.productsTest.message}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      placeholder="admin@mystore.com"
                      value={shopEmail}
                      onChange={(e) => setShopEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="storeDescription">Store Description (Optional)</Label>
                  <Textarea
                    id="storeDescription"
                    placeholder="Describe your store&apos;s brand, style, and target audience. This will help AI generate better product descriptions."
                    value={storeDescription}
                    onChange={(e) => setStoreDescription(e.target.value)}
                    rows={3}
                  />
                  <p className="text-xs text-gray-500">
                    This description will be used by AI to generate more relevant product titles and descriptions that match your store's style.
                  </p>
                </div>

                <div className="flex space-x-4">
                  <Button 
                    type="submit" 
                    className="flex-1" 
                    disabled={isLoading || (editingShop ? false : !connectionTest?.success)}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {editingShop ? 'Updating...' : 'Connecting...'}
                      </>
                    ) : (
                      editingShop ? 'Update Shop' : 'Connect Store'
                    )}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={resetForm}
                  >
                    Cancel
                  </Button>
                </div>
              </form>

              {!editingShop && (
                <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">How to get your Access Token:</h4>
                  <ol className="text-sm text-blue-800 space-y-1">
                    <li>1. Go to your Shopify admin panel</li>
                    <li>2. Navigate to Apps &gt; App and sales channel settings</li>
                    <li>3. Click &quot;Develop apps&quot; &gt; &quot;Create an app&quot;</li>
                    <li>4. Configure Admin API access permissions</li>
                    <li>5. Install the app and copy the access token</li>
                  </ol>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => window.open('https://help.shopify.com/en/manual/apps/apps-by-shopify/build-apps', '_blank')}
                  >
                    <ExternalLink className="mr-2 h-3 w-3" />
                    Learn More
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}

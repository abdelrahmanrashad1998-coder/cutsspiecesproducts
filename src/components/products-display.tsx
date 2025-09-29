'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { 
  Search, 
  Edit, 
  Trash2, 
  Package,
  Loader2,
  ExternalLink
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { useAuth, Shop } from '@/contexts/AuthContext'
import { formatCurrency } from '@/lib/utils'

interface Product {
  id: number
  title: string
  body_html: string
  vendor: string
  product_type: string
  status: string
  created_at: string
  updated_at: string
  handle: string
  variants: Array<{
    id: number
    title: string
    price: string
    sku: string
  }>
  images: Array<{
    id: number
    src: string
    alt: string | null
  }>
}

interface ProductsDisplayProps {
  selectedShop: Shop | null
}

export function ProductsDisplay({ selectedShop }: ProductsDisplayProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shopCurrency, setShopCurrency] = useState<string>('USD')
  const { firebaseUser } = useAuth()

  useEffect(() => {
    if (selectedShop) {
      fetchProducts()
    } else {
      setProducts([])
      setFilteredProducts([])
      setSearchTerm('')
      setError(null)
    }
  }, [selectedShop])

  useEffect(() => {
    const filtered = products.filter(product =>
      product.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.vendor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.product_type.toLowerCase().includes(searchTerm.toLowerCase())
    )
    setFilteredProducts(filtered)
  }, [products, searchTerm])

  const fetchProducts = async () => {
    if (!selectedShop) return

    setIsLoading(true)
    setError(null)
    
    try {
      if (!firebaseUser) {
        setError('Authentication required')
        return
      }

      const token = await firebaseUser.getIdToken()
      
      const response = await fetch(`/api/shops/${selectedShop.id}/products`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setProducts(data.products || [])
        const currency = data.shop?.currency || selectedShop.currency || 'USD'
        setShopCurrency(currency)
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to fetch products')
        toast.error(`Failed to fetch products: ${errorData.error}`)
      }
    } catch (error) {
      setError('Error fetching products')
      toast.error('Error fetching products')
    } finally {
      setIsLoading(false)
    }
  }


  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  if (!selectedShop) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Package className="mr-2 h-5 w-5" />
            Products
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p>Select a shop to view products</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <Package className="mr-2 h-5 w-5" />
            Products ({filteredProducts.length})
          </div>
          {selectedShop && (
            <Button variant="outline" size="sm" onClick={fetchProducts}>
              <Loader2 className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading products...</span>
          </div>
        ) : error ? (
          <div className="text-center py-8 text-red-500">
            <Package className="mx-auto h-12 w-12 text-red-400 mb-4" />
            <p>{error}</p>
            <Button variant="outline" onClick={fetchProducts} className="mt-4">
              Try Again
            </Button>
          </div>
        ) : (
          <>
            {/* Search */}
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search products by title, vendor, or category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Products Table */}
            {filteredProducts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {searchTerm ? 'No products found matching your search.' : 'No products found in this shop.'}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Image</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        {product.images.length > 0 ? (
                          <img
                            src={product.images[0].src}
                            alt={product.images[0].alt || product.title}
                            className="h-12 w-12 object-cover rounded"
                          />
                        ) : (
                          <div className="h-12 w-12 bg-gray-200 rounded flex items-center justify-center">
                            <Package className="h-6 w-6 text-gray-400" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        <div>
                          <div className="font-medium">{product.title}</div>
                          <div className="text-sm text-gray-500">#{product.handle}</div>
                        </div>
                      </TableCell>
                      <TableCell>{product.vendor}</TableCell>
                      <TableCell>{product.product_type}</TableCell>
                      <TableCell>
                        {product.variants.length > 0 ? formatCurrency(
                          product.variants[0].price, 
                          'EGP' // Temporary hardcode for testing
                        ) : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={product.status === 'active' ? 'default' : 'secondary'}>
                          {product.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {formatDate(product.created_at)}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(`https://${selectedShop.shopifyDomain}/products/${product.handle}`, '_blank')}
                            title="View product on store"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                          <Link href={`/edit-product/${product.id}`}>
                            <Button variant="outline" size="sm" title="Edit product">
                              <Edit className="h-4 w-4" />
                            </Button>
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
  ExternalLink,
  Check,
  RefreshCw,
  Save,
  X
} from 'lucide-react'
import { DataTablePagination } from '@/components/ui/data-table-pagination'
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
  collections?: Array<{
    id: number
    title: string
    handle: string
  }>
}

interface Collection {
  id: number
  title: string
  handle: string
}

interface ProductsDisplayProps {
  selectedShop: Shop | null
}

export function ProductsDisplay({ selectedShop }: ProductsDisplayProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFilter, setDateFilter] = useState<string>('all')
  const [isLoading, setIsLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shopCurrency, setShopCurrency] = useState<string>('USD')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(5)
  const [editingProduct, setEditingProduct] = useState<number | null>(null)
  const [editingCollection, setEditingCollection] = useState<string>('none')
  const [isUpdating, setIsUpdating] = useState(false)
  const [collections, setCollections] = useState<Collection[]>([])
  const [isLoadingCollections, setIsLoadingCollections] = useState(false)
  const { firebaseUser } = useAuth()

  useEffect(() => {
    if (selectedShop) {
      fetchProducts()
      fetchCollections()
    } else {
      setProducts([])
      setFilteredProducts([])
      setSearchTerm('')
      setError(null)
      setCurrentPage(1)
      setCollections([])
    }
  }, [selectedShop])

  useEffect(() => {
    let filtered = products.filter(product =>
      product.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.vendor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.product_type.toLowerCase().includes(searchTerm.toLowerCase())
    )

    // Apply date filter
    if (dateFilter !== 'all') {
      const now = new Date()
      const daysMap: { [key: string]: number } = {
        'today': 1,
        '7days': 7,
        '30days': 30,
        '90days': 90
      }
      const days = daysMap[dateFilter]
      const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
      
      filtered = filtered.filter(product => {
        const productDate = new Date(product.created_at)
        return productDate >= cutoffDate
      })
    }

    setFilteredProducts(filtered)
    setCurrentPage(1) // Reset to first page when filters change
  }, [products, searchTerm, dateFilter])

  const fetchCollections = async () => {
    if (!selectedShop || !firebaseUser) return

    setIsLoadingCollections(true)
    try {
      const token = await firebaseUser.getIdToken()
      
      const response = await fetch(`/api/shops/${selectedShop.id}/collections`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setCollections(data.collections || [])
      } else {
        console.error('Failed to fetch collections')
      }
    } catch (error) {
      console.error('Error fetching collections:', error)
    } finally {
      setIsLoadingCollections(false)
    }
  }

  // Calculate pagination
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedProducts = filteredProducts.slice(startIndex, endIndex)

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage)
    setCurrentPage(1) // Reset to first page when changing items per page
  }

  const fetchProducts = async (isRefresh = false) => {
    if (!selectedShop) return

    if (isRefresh) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }
    setError(null)
    setShowSuccess(false)
    
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
        
        if (isRefresh) {
          // Show success state briefly
          setShowSuccess(true)
          setTimeout(() => setShowSuccess(false), 1500)
        }
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to fetch products')
        toast.error(`Failed to fetch products: ${errorData.error}`)
      }
    } catch (error) {
      setError('Error fetching products')
      toast.error('Error fetching products')
    } finally {
      if (isRefresh) {
        // Add a small delay for smoother animation
        setTimeout(() => {
          setIsRefreshing(false)
        }, 300)
      } else {
        setIsLoading(false)
      }
    }
  }


  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  const startEditingCollection = (product: Product) => {
    setEditingProduct(product.id)
    // Set the current collection if the product belongs to any collections
    if (product.collections && product.collections.length > 0) {
      // For now, we'll use the first collection the product belongs to
      setEditingCollection(product.collections[0].id.toString())
    } else {
      setEditingCollection('none')
    }
  }

  const cancelEditing = () => {
    setEditingProduct(null)
    setEditingCollection('none')
  }

  const saveCollection = async (product: Product) => {
    if (!selectedShop || !firebaseUser) return

    setIsUpdating(true)
    try {
      const token = await firebaseUser.getIdToken()
      
      // Get current collection ID
      const currentCollectionId = product.collections && product.collections.length > 0 
        ? product.collections[0].id.toString() 
        : 'none'
      
      // Only update if collection has changed
      if (editingCollection !== currentCollectionId) {
        if (editingCollection && editingCollection !== "none") {
          // Add product to new collection
          const response = await fetch(`/api/shops/${selectedShop.id}/collections/${editingCollection}/products`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              productId: product.id
            }),
          })

          if (response.ok) {
            // Update local state to reflect the change
            const newCollection = collections.find(c => c.id.toString() === editingCollection)
            if (newCollection) {
              setProducts(prev => prev.map(p => 
                p.id === product.id 
                  ? { ...p, collections: [newCollection] }
                  : p
              ))
            }
            
            setEditingProduct(null)
            setEditingCollection('none')
            toast.success('Product collection updated successfully!')
          } else {
            const errorData = await response.json()
            toast.error(`Failed to update collection: ${errorData.error}`)
          }
        } else {
          // Product was removed from collections (set to "none")
          // Note: This requires manual removal from Shopify admin for manual collections
          setProducts(prev => prev.map(p => 
            p.id === product.id 
              ? { ...p, collections: [] }
              : p
          ))
          
          setEditingProduct(null)
          setEditingCollection('none')
          toast.success('Product removed from collection! Note: For manual collections, you may need to remove it from Shopify admin as well.')
        }
      } else {
        // No change needed
        setEditingProduct(null)
        setEditingCollection('none')
        toast.info('No changes made')
      }
    } catch (error) {
      toast.error('Error updating collection')
    } finally {
      setIsUpdating(false)
    }
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
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Package className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-xl">Products</CardTitle>
            <Badge variant="secondary" className="ml-2">
              {filteredProducts.length}
            </Badge>
          </div>
          {selectedShop && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => fetchProducts(true)}
              disabled={isRefreshing || isLoading}
            >
              {isRefreshing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : showSuccess ? (
                <Check className="mr-2 h-4 w-4 text-green-600" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Refresh
            </Button>
          )}
        </div>
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
            <Button variant="outline" onClick={() => fetchProducts(false)} className="mt-4">
              Try Again
            </Button>
          </div>
        ) : (
          <>
            {/* Search and Filters */}
            <div className="space-y-4 mb-6">
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search products by title, vendor, or category..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* Date Filter */}
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium whitespace-nowrap">Added:</label>
                  <Select
                    value={dateFilter}
                    onValueChange={setDateFilter}
                  >
                    <SelectTrigger className="h-10 w-[160px]">
                      <SelectValue placeholder="All time" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All time</SelectItem>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="7days">Last 7 days</SelectItem>
                      <SelectItem value="30days">Last 30 days</SelectItem>
                      <SelectItem value="90days">Last 90 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Rows per page selector */}
              <div className="flex items-center space-x-2">
                <p className="text-sm font-medium">Rows per page</p>
                <Select
                  value={`${itemsPerPage}`}
                  onValueChange={(value) => {
                    handleItemsPerPageChange(Number(value))
                  }}
                >
                  <SelectTrigger className="h-8 w-[70px]">
                    <SelectValue placeholder={itemsPerPage} />
                  </SelectTrigger>
                  <SelectContent side="top">
                    {[5, 10, 20, 30, 40, 50].map((pageSize) => (
                      <SelectItem key={pageSize} value={`${pageSize}`}>
                        {pageSize}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Products Table */}
            {filteredProducts.length === 0 ? (
              <div className="text-center py-12">
                <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground mb-2">
                  {searchTerm ? 'No products found' : 'No products available'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {searchTerm ? 'Try adjusting your search terms.' : 'Add your first product to get started.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16 hidden sm:table-cell">Image</TableHead>
                      <TableHead className="min-w-[200px]">Product</TableHead>
                      <TableHead className="min-w-[120px] hidden md:table-cell">Vendor</TableHead>
                      <TableHead className="min-w-[120px] hidden lg:table-cell">Collection</TableHead>
                      <TableHead className="w-24 hidden sm:table-cell">Price</TableHead>
                      <TableHead className="w-24">Status</TableHead>
                      <TableHead className="w-32 hidden lg:table-cell">Created</TableHead>
                      <TableHead className="w-24">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedProducts.map((product) => (
                      <TableRow key={product.id} className="group">
                        <TableCell className="hidden sm:table-cell">
                          <div className="relative">
                            {product.images.length > 0 ? (
                              <img
                                src={product.images[0].src}
                                alt={product.images[0].alt || product.title}
                                className="h-12 w-12 object-cover rounded-lg border"
                              />
                            ) : (
                              <div className="h-12 w-12 bg-muted rounded-lg flex items-center justify-center border">
                                <Package className="h-5 w-5 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <div className="sm:hidden">
                                {product.images.length > 0 ? (
                                  <img
                                    src={product.images[0].src}
                                    alt={product.images[0].alt || product.title}
                                    className="h-8 w-8 object-cover rounded border"
                                  />
                                ) : (
                                  <div className="h-8 w-8 bg-muted rounded flex items-center justify-center border">
                                    <Package className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-sm leading-tight truncate">{product.title}</div>
                                <div className="text-xs text-muted-foreground font-mono">#{product.handle}</div>
                                <div className="md:hidden text-xs text-muted-foreground">
                                  {product.vendor && `${product.vendor} • `}
                                  {product.variants.length > 0 && formatCurrency(product.variants[0].price, shopCurrency)}
                                </div>
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <span className="text-sm">{product.vendor || '—'}</span>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {editingProduct === product.id ? (
                            <div className="flex items-center space-x-2">
                              <Select value={editingCollection} onValueChange={setEditingCollection}>
                                <SelectTrigger className="h-8 text-sm w-32">
                                  <SelectValue placeholder="Select collection" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">No collection</SelectItem>
                                  {collections.map((collection) => (
                                    <SelectItem key={collection.id} value={collection.id.toString()}>
                                      {collection.title}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => saveCollection(product)}
                                disabled={isUpdating}
                                className="h-8 w-8 p-0"
                              >
                                <Save className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={cancelEditing}
                                className="h-8 w-8 p-0"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-2 group">
                              <span className="text-sm">
                                {product.collections && product.collections.length > 0 
                                  ? product.collections[0].title 
                                  : '—'
                                }
                              </span>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => startEditingCollection(product)}
                                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <span className="font-medium text-sm">
                            {product.variants.length > 0 ? formatCurrency(
                              product.variants[0].price, 
                              shopCurrency
                            ) : '—'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={product.status === 'active' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {product.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <span className="text-sm text-muted-foreground">
                            {formatDate(product.created_at)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(`https://${selectedShop.shopifyDomain}/products/${product.handle}`, '_blank')}
                              title="View product on store"
                              className="h-8 w-8 p-0"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                            <Link href={`/edit-product/${product.id}`}>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                title="Edit product"
                                className="h-8 w-8 p-0"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                
                {/* Pagination */}
                <div className="mt-4">
                  <DataTablePagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={filteredProducts.length}
                    itemsPerPage={itemsPerPage}
                    onPageChange={handlePageChange}
                    onItemsPerPageChange={handleItemsPerPageChange}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

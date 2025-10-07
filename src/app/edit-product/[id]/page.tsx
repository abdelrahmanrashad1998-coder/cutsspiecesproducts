'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Upload, 
  Image as ImageIcon, 
  X, 
  Plus,
  Loader2,
  Sparkles,
  Save
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'

interface Product {
  id: number
  title: string
  body_html: string
  vendor: string
  product_type: string
  variants: Array<{
    id: number
    title: string
    price: string
    option1?: string
    option2?: string
    option3?: string
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

interface ProductVariant {
  id: string
  title: string
  price: string
  option1?: string
  option2?: string
  option3?: string
  inventory_tracking: boolean
}

interface Collection {
  id: number
  title: string
  handle: string
}

export default function EditProductPage() {
  const params = useParams()
  const router = useRouter()
  const productId = params.id as string
  const { firebaseUser } = useAuth()
  
  const [product, setProduct] = useState<Product | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [newImages, setNewImages] = useState<File[]>([])
  const [newImageUrls, setNewImageUrls] = useState<string[]>([])
  const [productData, setProductData] = useState({
    title: '',
    description: '',
    vendor: '',
  })
  const [variants, setVariants] = useState<ProductVariant[]>([])
  const [selectedShop, setSelectedShop] = useState<any>(null)
  const [collections, setCollections] = useState<Collection[]>([])
  const [selectedCollection, setSelectedCollection] = useState<string>('none')
  const [isLoadingCollections, setIsLoadingCollections] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (productId) {
      fetchProduct()
    }
  }, [productId])

  useEffect(() => {
    if (selectedShop && firebaseUser) {
      fetchCollections()
    } else {
      setCollections([])
      setSelectedCollection('none')
    }
  }, [selectedShop, firebaseUser])

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

  const fetchProduct = async () => {
    try {
      if (!firebaseUser) {
        toast.error('Authentication required')
        router.push('/login')
        return
      }

      // First, get the user's shops to find which shop has this product
      const token = await firebaseUser.getIdToken()
      
      // For now, let's try to get shops and then fetch products from each shop
      const shopsResponse = await fetch('/api/shops', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      
      if (!shopsResponse.ok) {
        toast.error('Failed to fetch shops')
        router.push('/dashboard')
        return
      }
      
      const shopsData = await shopsResponse.json()
      const shops = shopsData.shops || []
      
      // Try to find the product in each shop
      let foundProduct = null
      let foundShop = null
      
      for (const shop of shops) {
        try {
          // First try the direct product endpoint
          const productResponse = await fetch(`/api/shops/${shop.id}/products/${productId}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          })
          
          if (productResponse.ok) {
            const productData = await productResponse.json()
            foundProduct = productData.product
            foundShop = shop
            break
          } else if (productResponse.status === 404) {
            // Product not found in this shop, continue to next shop
            continue
          }
        } catch (error) {
          console.error(`Error fetching product from shop ${shop.id}:`, error)
          // Fallback: try the products list endpoint
          try {
            const productsResponse = await fetch(`/api/shops/${shop.id}/products`, {
              headers: {
                'Authorization': `Bearer ${token}`,
              },
            })
            
            if (productsResponse.ok) {
              const productsData = await productsResponse.json()
              const product = productsData.products.find((p: any) => p.id.toString() === productId)
              
              if (product) {
                foundProduct = product
                foundShop = shop
                break
              }
            }
          } catch (fallbackError) {
            console.error(`Error fetching products from shop ${shop.id}:`, fallbackError)
          }
        }
      }
      
      if (foundProduct && foundShop) {
        setProduct(foundProduct)
        setSelectedShop(foundShop)
        setProductData({
          title: foundProduct.title,
          description: foundProduct.body_html,
          vendor: foundProduct.vendor,
        })
        setVariants(foundProduct.variants.map((v: any) => ({
          id: v.id.toString(),
          title: v.title,
          price: v.price,
          option1: v.option1,
          option2: v.option2,
          option3: v.option3,
          inventory_tracking: v.inventory_management === 'shopify',
        })))
        
        // Set the selected collection based on the product's current collections
        if (foundProduct.collections && foundProduct.collections.length > 0) {
          // For now, we'll select the first collection the product belongs to
          // In a more advanced implementation, you might want to handle multiple collections
          setSelectedCollection(foundProduct.collections[0].id.toString())
        } else {
          setSelectedCollection('none')
        }
      } else {
        toast.error('Product not found in any of your shops')
        router.push('/dashboard')
      }
    } catch (error) {
      console.error('Error fetching product:', error)
      toast.error('Error fetching product')
      router.push('/dashboard')
    } finally {
      setIsLoading(false)
    }
  }

  const handleNewImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const newFiles = [...newImages, ...files]
    setNewImages(newFiles)

    const newUrls = files.map(file => URL.createObjectURL(file))
    setNewImageUrls(prev => [...prev, ...newUrls])
  }

  const removeNewImage = (index: number) => {
    const newFiles = newImages.filter((_, i) => i !== index)
    const newUrls = newImageUrls.filter((_, i) => i !== index)
    setNewImages(newFiles)
    setNewImageUrls(newUrls)
  }

  const removeExistingImage = async (imageId: number) => {
    // This would require additional API endpoint to remove images from Shopify
    toast.info('Image removal not implemented in this demo')
  }

  const addVariant = () => {
    const newVariant: ProductVariant = {
      id: Date.now().toString(),
      title: '', // Title will be auto-generated by Shopify
      price: '0.00',
      inventory_tracking: false
    }
    setVariants([...variants, newVariant])
  }

  const updateVariant = (id: string, field: keyof ProductVariant, value: string | boolean) => {
    setVariants(variants.map(variant => 
      variant.id === id ? { ...variant, [field]: value } : variant
    ))
  }

  const removeVariant = (id: string) => {
    if (variants.length > 1) {
      setVariants(variants.filter(variant => variant.id !== id))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!productData.title || !productData.description) {
      toast.error('Please fill in all required fields')
      return
    }

    // Validate variants
    for (let i = 0; i < variants.length; i++) {
      const variant = variants[i]
      if (!variant.price || parseFloat(variant.price) < 0) {
        toast.error(`Variant ${i + 1}: Please enter a valid price`)
        return
      }
      if (!variant.option1) {
        toast.error(`Variant ${i + 1}: Please enter a size`)
        return
      }
    }

    setIsSubmitting(true)
    try {
      // Upload new images first
      const uploadedImageUrls: string[] = []
      for (const image of newImages) {
        const formData = new FormData()
        formData.append('image', image)
        
        const uploadResponse = await fetch('/api/upload-image', {
          method: 'POST',
          body: formData,
        })
        
        if (uploadResponse.ok) {
          const uploadData = await uploadResponse.json()
          uploadedImageUrls.push(uploadData.url)
        }
      }

      // Combine existing images with new ones
      const allImages = [
        ...product?.images.map(img => ({ src: img.src })) || [],
        ...uploadedImageUrls.map(url => ({ src: url }))
      ]

      // Update product
      const productPayload = {
        title: productData.title,
        body_html: productData.description,
        vendor: productData.vendor,
        variants: variants.map(variant => {
          const variantData: any = {
            price: variant.price,
            option1: variant.option1,
            option2: variant.option2,
            option3: variant.option3,
            inventory_management: variant.inventory_tracking ? 'shopify' : null,
          }
          
          // Only include ID if it's from the original product (existing Shopify variant)
          // Check if this variant ID exists in the original product variants
          const originalVariant = product?.variants.find(v => v.id.toString() === variant.id)
          if (originalVariant) {
            variantData.id = parseInt(variant.id)
            console.log('Updating existing variant:', variant.id, variantData)
          } else {
            console.log('Creating new variant (no ID):', variantData)
          }
          // If no original variant found, it's a new variant (no ID = Shopify will create it)
          
          return variantData
        }),
        images: allImages
      }

      console.log('Product payload variants:', productPayload.variants)
      console.log('Original product variants:', product?.variants)

      const response = await fetch(`/api/shops/${selectedShop.id}/products/${productId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await firebaseUser.getIdToken()}`,
        },
        body: JSON.stringify(productPayload),
      })

      if (response.ok) {
        // Handle collection changes
        const currentCollectionId = product?.collections && product.collections.length > 0 
          ? product.collections[0].id.toString() 
          : 'none'
        
        // Only update collection if it has changed
        if (selectedCollection !== currentCollectionId) {
          try {
            // If product was in a collection and now it's "none", we need to remove it
            // Note: Shopify doesn't have a direct "remove from collection" API for manual collections
            // For automatic collections, products are added/removed based on rules
            // For manual collections, we can only add products, not remove them via API
            
            if (selectedCollection && selectedCollection !== "none") {
              // Add product to the new collection
              const collectionResponse = await fetch(`/api/shops/${selectedShop.id}/collections/${selectedCollection}/products`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${await firebaseUser.getIdToken()}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  productId: parseInt(productId)
                }),
              })

              if (collectionResponse.ok) {
                toast.success('Product updated and collection changed successfully!')
              } else {
                toast.success('Product updated successfully, but failed to update collection')
              }
            } else {
              // Product was removed from collections (set to "none")
              // Note: This requires manual removal from Shopify admin for manual collections
              toast.success('Product updated successfully! Note: To remove from collections, please use the Shopify admin panel.')
            }
          } catch (collectionError) {
            toast.success('Product updated successfully, but failed to update collection')
          }
        } else {
          toast.success('Product updated successfully!')
        }
        
        router.push('/dashboard')
      } else {
        const errorData = await response.json()
        console.error('Product update error:', errorData)
        
        let errorMessage = errorData.error || 'Failed to update product'
        if (response.status === 422) {
          errorMessage = 'Product validation failed'
          if (errorData.details?.errors) {
            // Show specific Shopify validation errors
            const errors = errorData.details.errors
            if (typeof errors === 'object') {
              const errorMessages = Object.entries(errors).map(([field, messages]) => 
                `${field}: ${Array.isArray(messages) ? messages.join(', ') : messages}`
              )
              errorMessage = `Validation errors: ${errorMessages.join('; ')}`
            }
          }
        }
        
        toast.error(errorMessage)
      }
    } catch (error) {
      toast.error('Error updating product')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    )
  }

  if (!product) {
    return (
      <DashboardLayout>
        <div className="text-center py-8">
          <p className="text-gray-500">Product not found</p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Edit Product</h1>
          <p className="text-gray-600">Update product details and images</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Existing Images */}
          <Card>
            <CardHeader>
              <CardTitle>Current Images</CardTitle>
            </CardHeader>
            <CardContent>
              {product.images.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {product.images.map((image) => (
                    <div key={image.id} className="relative">
                      <img
                        src={image.src}
                        alt={image.alt || product.title}
                        className="w-full h-24 object-cover rounded"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                        onClick={() => removeExistingImage(image.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No images uploaded</p>
              )}
            </CardContent>
          </Card>

          {/* New Image Upload */}
          <Card>
            <CardHeader>
              <CardTitle>Add New Images</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleNewImageUpload}
                  className="hidden"
                />
                <ImageIcon className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2 text-sm text-gray-600">
                  Click to upload additional images
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-4"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Images
                </Button>
              </div>

              {newImageUrls.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {newImageUrls.map((url, index) => (
                    <div key={index} className="relative">
                      <img
                        src={url}
                        alt={`New upload ${index + 1}`}
                        className="w-full h-24 object-cover rounded"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                        onClick={() => removeNewImage(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Product Details */}
          <Card>
            <CardHeader>
              <CardTitle>Product Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Product Title *</Label>
                  <Input
                    id="title"
                    value={productData.title}
                    onChange={(e) => setProductData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Enter product title"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vendor">Vendor</Label>
                  <Input
                    id="vendor"
                    value={productData.vendor}
                    onChange={(e) => setProductData(prev => ({ ...prev, vendor: e.target.value }))}
                    placeholder="Enter vendor name"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  value={productData.description}
                  onChange={(e) => setProductData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter product description"
                  rows={4}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="collection">Collection (Optional)</Label>
                <Select value={selectedCollection} onValueChange={setSelectedCollection}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder={isLoadingCollections ? "Loading collections..." : "Select a collection"} />
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
              </div>
            </CardContent>
          </Card>

          {/* Variants */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Product Variants</CardTitle>
                <Button type="button" onClick={addVariant} variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Variant
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {variants.map((variant, index) => (
                <div key={variant.id} className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Variant {index + 1}</h4>
                    {variants.length > 1 && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => removeVariant(variant.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Size</Label>
                      <Input
                        value={variant.option1 || ''}
                        onChange={(e) => updateVariant(variant.id, 'option1', e.target.value)}
                        placeholder="Small"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Price</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={variant.price}
                        onChange={(e) => updateVariant(variant.id, 'price', e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Color (Optional)</Label>
                      <Input
                        value={variant.option2 || ''}
                        onChange={(e) => updateVariant(variant.id, 'option2', e.target.value)}
                        placeholder="Red"
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <Label>Inventory Tracking</Label>
                    <Button
                      type="button"
                      variant={variant.inventory_tracking ? "default" : "outline"}
                      size="sm"
                      onClick={() => updateVariant(variant.id, 'inventory_tracking', !variant.inventory_tracking)}
                    >
                      {variant.inventory_tracking ? 'Tracked' : 'Untracked'}
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex justify-end space-x-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/dashboard')}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating Product...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Update Product
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  )
}

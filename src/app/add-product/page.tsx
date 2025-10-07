'use client'

import { useState, useRef, useEffect } from 'react'
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
  Sparkles
} from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { ShopDropdown } from '@/components/shop-dropdown'

interface ProductVariant {
  id: string
  title: string
  price: string
  option1?: string
  option2?: string
  option3?: string
  inventory_tracking: boolean
}

interface ProductAnalysis {
  title: string
  description: string
  tags: string
  suggestedCollection?: string
}

interface Collection {
  id: number
  title: string
  handle: string
}

export default function AddProductPage() {
  const { user, firebaseUser, selectedShop, setSelectedShop } = useAuth()
  const [images, setImages] = useState<File[]>([])
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [uploadedImageUrls, setUploadedImageUrls] = useState<string[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<ProductAnalysis | null>(null)
  const [productData, setProductData] = useState({
    title: '',
    description: '',
    vendor: '',
    tags: ''
  })
  const [defaultVendor, setDefaultVendor] = useState<string>('')
  const [variants, setVariants] = useState<ProductVariant[]>([
    { id: '1', title: '', price: '0.00', inventory_tracking: false }
  ])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [collections, setCollections] = useState<Collection[]>([])
  const [selectedCollection, setSelectedCollection] = useState<string>('none')
  const [isLoadingCollections, setIsLoadingCollections] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Fetch collections and default vendor when shop changes
  useEffect(() => {
    if (selectedShop && firebaseUser) {
      fetchCollections()
      fetchDefaultVendor()
    } else {
      setCollections([])
      setSelectedCollection('none')
      setDefaultVendor('')
      setProductData(prev => ({ ...prev, vendor: '' }))
    }
  }, [selectedShop, firebaseUser])

  const fetchDefaultVendor = async () => {
    if (!selectedShop || !firebaseUser) return

    try {
      const token = await firebaseUser.getIdToken()
      
      // First try to get user settings for default vendor
      const settingsResponse = await fetch('/api/user/settings', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      let vendorSetting = 'store_name' // default behavior
      let settingsData: any = {}
      if (settingsResponse.ok) {
        settingsData = await settingsResponse.json()
        vendorSetting = settingsData.defaultVendor || 'store_name'
      }

      // Set the default vendor based on the setting
      if (vendorSetting === 'store_name' && selectedShop.shopName) {
        setDefaultVendor(selectedShop.shopName)
        setProductData(prev => ({ ...prev, vendor: selectedShop.shopName }))
      } else if (vendorSetting === 'custom' && settingsData?.customVendor) {
        setDefaultVendor(settingsData.customVendor)
        setProductData(prev => ({ ...prev, vendor: settingsData.customVendor }))
      } else {
        setDefaultVendor('')
        setProductData(prev => ({ ...prev, vendor: '' }))
      }
    } catch (error) {
      console.error('Error fetching default vendor setting:', error)
      // Fallback to store name
      if (selectedShop.shopName) {
        setDefaultVendor(selectedShop.shopName)
        setProductData(prev => ({ ...prev, vendor: selectedShop.shopName }))
      }
    }
  }

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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const newImages = [...images, ...files]
    setImages(newImages)

    // Create object URLs for preview
    const newUrls = files.map(file => URL.createObjectURL(file))
    setImageUrls(prev => [...prev, ...newUrls])
  }

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index)
    const newUrls = imageUrls.filter((_, i) => i !== index)
    setImages(newImages)
    setImageUrls(newUrls)
  }

  const analyzeImages = async () => {
    if (images.length === 0) {
      toast.error('Please upload at least one image')
      return
    }

    // Ensure collections are loaded before analysis
    if (collections.length === 0 && selectedShop) {
      await fetchCollections()
    }

    setIsAnalyzing(true)
    try {
      // First upload images to get actual URLs
      const newUploadedUrls: string[] = []
      for (const image of images) {
        const formData = new FormData()
        formData.append('image', image)
        
        const uploadResponse = await fetch('/api/upload-image', {
          method: 'POST',
          body: formData,
        })
        
        if (uploadResponse.ok) {
          const uploadData = await uploadResponse.json()
          newUploadedUrls.push(uploadData.url)
        }
      }

      if (newUploadedUrls.length === 0) {
        toast.error('Failed to upload images for analysis')
        return
      }

      // Store uploaded URLs for later use
      setUploadedImageUrls(newUploadedUrls)

      // Get auth token for AI analysis
      const token = await firebaseUser?.getIdToken()
      if (!token) {
        toast.error('Authentication required for AI analysis')
        return
      }

      // Now analyze the uploaded images
      const response = await fetch('/api/analyze-images', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          imageUrls: newUploadedUrls,
          shopId: selectedShop?.id 
        }),
      })

      const data = await response.json()
      if (response.ok) {
        setAnalysis(data.analysis)
        setProductData(prev => ({
          ...prev,
          title: data.analysis.title,
          description: data.analysis.description,
          tags: data.analysis.tags
        }))
        
        // Auto-select suggested collection if available
        if (data.analysis.suggestedCollection) {
          const suggestedCollectionName = data.analysis.suggestedCollection.toLowerCase()
          
          // Try to find an exact match first
          let matchingCollection = collections.find(c => 
            c.title.toLowerCase() === suggestedCollectionName
          )
          
          // If no exact match, try partial matches
          if (!matchingCollection) {
            matchingCollection = collections.find(c => 
              c.title.toLowerCase().includes(suggestedCollectionName) ||
              suggestedCollectionName.includes(c.title.toLowerCase())
            )
          }
          
          // If still no match, try word-based matching
          if (!matchingCollection) {
            const suggestedWords = suggestedCollectionName.split(/\s+/)
            matchingCollection = collections.find(c => {
              const collectionWords = c.title.toLowerCase().split(/\s+/)
              return suggestedWords.some(word => 
                word.length > 2 && collectionWords.some(cWord => 
                  cWord.includes(word) || word.includes(cWord)
                )
              )
            })
          }
          
          if (matchingCollection) {
            setSelectedCollection(matchingCollection.id.toString())
            toast.success(`Auto-selected collection: ${matchingCollection.title}`)
          } else {
            // If no matching collection found, keep "none" selected
            setSelectedCollection('none')
            toast.info(`AI suggested collection "${data.analysis.suggestedCollection}" but no matching collection found. You can create a new collection or select an existing one.`)
          }
        }
        
        toast.success('Images analyzed successfully!')
      } else {
        toast.error(data.error || 'Failed to analyze images')
      }
    } catch (error) {
      toast.error('Error analyzing images')
    } finally {
      setIsAnalyzing(false)
    }
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

    setIsSubmitting(true)
    try {
      // Use already uploaded images if available, otherwise upload new ones
      const finalImageUrls = uploadedImageUrls
      
      if (finalImageUrls.length === 0) {
        // Upload images if not already uploaded
        for (const image of images) {
          const formData = new FormData()
          formData.append('image', image)
          
          const uploadResponse = await fetch('/api/upload-image', {
            method: 'POST',
            body: formData,
          })
          
          if (uploadResponse.ok) {
            const uploadData = await uploadResponse.json()
            finalImageUrls.push(uploadData.url)
          }
        }
      }

      // Create product
      const productPayload = {
        title: productData.title,
        body_html: productData.description,
        vendor: productData.vendor || 'Default Vendor',
        tags: productData.tags,
        variants: variants.map(variant => ({
          price: variant.price,
          option1: variant.option1,
          option2: variant.option2,
          option3: variant.option3,
          inventory_management: variant.inventory_tracking ? 'shopify' : null,
        })),
        images: finalImageUrls.map(url => ({ src: url }))
      }

      // Get auth token for API call
      const token = await firebaseUser?.getIdToken()
      if (!token) {
        toast.error('Authentication required')
        return
      }

      const response = await fetch('/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(productPayload),
      })

      if (response.ok) {
        const productData = await response.json()
        
        // Add product to collection if one is selected
        if (selectedCollection && selectedCollection !== "none" && productData.product?.id) {
          try {
            const collectionResponse = await fetch(`/api/shops/${selectedShop.id}/collections/${selectedCollection}/products`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                productId: productData.product.id
              }),
            })

            if (collectionResponse.ok) {
              toast.success('Product created and added to collection successfully!')
            } else {
              toast.success('Product created successfully, but failed to add to collection')
            }
          } catch (collectionError) {
            toast.success('Product created successfully, but failed to add to collection')
          }
        } else {
          toast.success('Product created successfully!')
        }
        
        router.push('/dashboard')
      } else {
        const errorData = await response.json()
        toast.error(errorData.error || 'Failed to create product')
      }
    } catch (error) {
      toast.error('Error creating product')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Add New Product</h1>
          <p className="text-gray-600">Upload images and create a new product</p>
        </div>

        {/* Shop Selection */}
        <div className="bg-white p-6 rounded-lg border">
          <div className="space-y-2">
            <Label>Select Store</Label>
            <ShopDropdown 
              selectedShop={selectedShop} 
              onShopSelect={setSelectedShop} 
            />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Image Upload Section */}
          <Card>
            <CardHeader>
              <CardTitle>Product Images</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <ImageIcon className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2 text-sm text-gray-600">
                  Click to upload images or drag and drop
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

              {imageUrls.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {imageUrls.map((url, index) => (
                    <div key={index} className="relative">
                      <img
                        src={url}
                        alt={`Upload ${index + 1}`}
                        className="w-full h-24 object-cover rounded"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                        onClick={() => removeImage(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {imageUrls.length > 0 && (
                <Button
                  type="button"
                  onClick={analyzeImages}
                  disabled={isAnalyzing}
                  className="w-full"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Analyzing Images...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Analyze Images with AI
                    </>
                  )}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Product Details Section */}
          <Card>
            <CardHeader>
              <CardTitle>Product Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Product Title - Full Width */}
              <div className="space-y-2">
                <Label htmlFor="title">Product Title *</Label>
                <Input
                  id="title"
                  value={productData.title}
                  onChange={(e) => setProductData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter product title"
                  required
                  className="h-10"
                />
              </div>

              {/* Description - Full Width */}
              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  value={productData.description}
                  onChange={(e) => setProductData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter product description"
                  rows={4}
                  required
                  className="min-h-[100px]"
                />
              </div>

              {/* Vendor and Tags - Two Column Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="vendor">Vendor</Label>
                  <Input
                    id="vendor"
                    value={productData.vendor}
                    onChange={(e) => setProductData(prev => ({ ...prev, vendor: e.target.value }))}
                    placeholder={defaultVendor ? `Default: ${defaultVendor}` : "Enter vendor name"}
                    className="h-10"
                  />
                  {defaultVendor && (
                    <p className="text-xs text-muted-foreground">
                      Default vendor: {defaultVendor} (can be changed in Settings)
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tags">Tags</Label>
                  <Input
                    id="tags"
                    value={productData.tags}
                    onChange={(e) => setProductData(prev => ({ ...prev, tags: e.target.value }))}
                    placeholder="Enter tags separated by commas"
                    className="h-10"
                  />
                  <p className="text-xs text-muted-foreground">
                    Separate multiple tags with commas
                  </p>
                </div>
              </div>

              {/* Collection - Full Width */}
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
                {analysis?.suggestedCollection && (
                  <div className="text-sm text-muted-foreground">
                    <p>AI suggested: "{analysis.suggestedCollection}"</p>
                    {selectedCollection !== 'none' && collections.find(c => c.id.toString() === selectedCollection) && (
                      <p className="text-green-600 font-medium">
                        ✓ Auto-selected: {collections.find(c => c.id.toString() === selectedCollection)?.title}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Variants Section */}
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
                        className="h-10"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Price *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={variant.price}
                        onChange={(e) => updateVariant(variant.id, 'price', e.target.value)}
                        placeholder="0.00"
                        className="h-10"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Color (Optional)</Label>
                      <Input
                        value={variant.option2 || ''}
                        onChange={(e) => updateVariant(variant.id, 'option2', e.target.value)}
                        placeholder="Red"
                        className="h-10"
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
                  Creating Product...
                </>
              ) : (
                'Create Product'
              )}
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  )
}

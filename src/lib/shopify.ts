import axios from 'axios'

const SHOPIFY_STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN || 'demo-store.myshopify.com'
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN || 'demo-token'

// Only throw error if we're actually trying to make API calls
const validateShopifyConfig = () => {
  if (!process.env.SHOPIFY_STORE_DOMAIN || !process.env.SHOPIFY_ACCESS_TOKEN) {
    throw new Error('Missing Shopify environment variables. Please set SHOPIFY_STORE_DOMAIN and SHOPIFY_ACCESS_TOKEN in your .env file.')
  }
}

const shopifyApi = axios.create({
  baseURL: `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-01`,
  headers: {
    'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
    'Content-Type': 'application/json',
  },
})

export interface ShopifyProduct {
  id: number
  title: string
  body_html: string
  vendor: string
  product_type: string
  created_at: string
  handle: string
  updated_at: string
  published_at: string
  template_suffix: string | null
  status: string
  published_scope: string
  tags: string
  admin_graphql_api_id: string
  variants: ShopifyVariant[]
  options: ShopifyOption[]
  images: ShopifyImage[]
  image: ShopifyImage | null
}

export interface ShopifyVariant {
  id: number
  product_id: number
  title: string
  price: string
  sku: string
  position: number
  inventory_policy: string
  compare_at_price: string | null
  fulfillment_service: string
  inventory_management: string
  option1: string | null
  option2: string | null
  option3: string | null
  created_at: string
  updated_at: string
  taxable: boolean
  barcode: string | null
  grams: number
  image_id: number | null
  weight: number
  weight_unit: string
  inventory_item_id: number
  inventory_quantity: number
  old_inventory_quantity: number
  requires_shipping: boolean
  admin_graphql_api_id: string
}

export interface ShopifyOption {
  id: number
  product_id: number
  name: string
  position: number
  values: string[]
}

export interface ShopifyImage {
  id: number
  product_id: number
  position: number
  created_at: string
  updated_at: string
  alt: string | null
  width: number
  height: number
  src: string
  variant_ids: number[]
  admin_graphql_api_id: string
}

export interface CreateProductData {
  title: string
  body_html: string
  vendor: string
  product_type: string
  tags: string
  variants: Array<{
    price: string
    option1?: string
    option2?: string
    option3?: string
  }>
  images: Array<{
    src: string
    alt?: string
  }>
}

export async function getProducts(): Promise<ShopifyProduct[]> {
  try {
    validateShopifyConfig()
    const response = await shopifyApi.get('/products.json')
    return response.data.products
  } catch (error) {
    console.error('Error fetching products:', error)
    throw new Error('Failed to fetch products from Shopify')
  }
}

export async function getProduct(id: number): Promise<ShopifyProduct> {
  try {
    validateShopifyConfig()
    const response = await shopifyApi.get(`/products/${id}.json`)
    return response.data.product
  } catch (error) {
    console.error('Error fetching product:', error)
    throw new Error('Failed to fetch product from Shopify')
  }
}

export async function createProduct(productData: CreateProductData): Promise<ShopifyProduct> {
  try {
    validateShopifyConfig()
    const response = await shopifyApi.post('/products.json', {
      product: productData
    })
    return response.data.product
  } catch (error) {
    console.error('Error creating product:', error)
    throw new Error('Failed to create product in Shopify')
  }
}

export async function updateProduct(id: number, productData: Partial<CreateProductData>): Promise<ShopifyProduct> {
  try {
    validateShopifyConfig()
    const response = await shopifyApi.put(`/products/${id}.json`, {
      product: productData
    })
    return response.data.product
  } catch (error) {
    console.error('Error updating product:', error)
    throw new Error('Failed to update product in Shopify')
  }
}

export async function deleteProduct(id: number): Promise<void> {
  try {
    validateShopifyConfig()
    await shopifyApi.delete(`/products/${id}.json`)
  } catch (error) {
    console.error('Error deleting product:', error)
    throw new Error('Failed to delete product from Shopify')
  }
}

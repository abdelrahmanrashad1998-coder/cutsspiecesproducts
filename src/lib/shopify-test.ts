import axios from 'axios'

export interface ShopifyConnectionTest {
  success: boolean
  message: string
  shopInfo?: {
    name: string
    domain: string
    email: string
    currency: string
    timezone: string
  }
  error?: string
}

export async function testShopifyConnection(
  shopifyDomain: string, 
  accessToken: string
): Promise<ShopifyConnectionTest> {
  try {
    // Clean the domain
    const cleanDomain = shopifyDomain.replace(/^https?:\/\//, '').replace(/\.myshopify\.com$/, '') + '.myshopify.com'
    
    const response = await axios.get(`https://${cleanDomain}/admin/api/2024-01/shop.json`, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
      timeout: 10000 // 10 second timeout
    })

    if (response.data && response.data.shop) {
      const shop = response.data.shop
      return {
        success: true,
        message: 'Connection successful!',
        shopInfo: {
          name: shop.name,
          domain: shop.domain,
          email: shop.email,
          currency: shop.currency,
          timezone: shop.timezone
        }
      }
    } else {
      return {
        success: false,
        message: 'Invalid response from Shopify',
        error: 'No shop data received'
      }
    }
  } catch (error: any) {
    let errorMessage = 'Connection failed'
    
    if (error.response) {
      const status = error.response.status
      switch (status) {
        case 401:
          errorMessage = 'Invalid access token. Please check your token and ensure it has the required permissions (read_products, write_products)'
          break
        case 403:
          errorMessage = 'Access token does not have required permissions'
          break
        case 404:
          errorMessage = 'Shop not found or domain is incorrect. Use format: your-shop.myshopify.com'
          break
        case 429:
          errorMessage = 'Rate limit exceeded'
          break
        default:
          errorMessage = `HTTP ${status}: ${error.response.data?.message || 'Unknown error'}`
      }
    } else if (error.code === 'ENOTFOUND') {
      errorMessage = 'Invalid domain or network error'
    } else if (error.code === 'ECONNABORTED') {
      errorMessage = 'Connection timeout'
    }

    return {
      success: false,
      message: errorMessage,
      error: error.message
    }
  }
}

export async function testShopifyProductsAccess(
  shopifyDomain: string, 
  accessToken: string
): Promise<{ success: boolean; message: string; productCount?: number }> {
  try {
    const cleanDomain = shopifyDomain.replace(/^https?:\/\//, '').replace(/\.myshopify\.com$/, '') + '.myshopify.com'
    
    const response = await axios.get(`https://${cleanDomain}/admin/api/2024-01/products.json?limit=1`, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
      timeout: 10000
    })

    if (response.data && response.data.products) {
      return {
        success: true,
        message: 'Products access confirmed',
        productCount: response.data.products.length
      }
    } else {
      return {
        success: false,
        message: 'Cannot access products'
      }
    }
  } catch (error: any) {
    return {
      success: false,
      message: `Products access failed: ${error.message}`
    }
  }
}

export async function testShopifyCollectionsAccess(
  shopifyDomain: string, 
  accessToken: string
): Promise<{ success: boolean; message: string; collectionCount?: number }> {
  try {
    const cleanDomain = shopifyDomain.replace(/^https?:\/\//, '').replace(/\.myshopify\.com$/, '') + '.myshopify.com'
    
    const response = await axios.get(`https://${cleanDomain}/admin/api/2024-01/collection_listings.json?limit=1`, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
      timeout: 10000
    })

    if (response.data && response.data.collection_listings) {
      return {
        success: true,
        message: 'Collection listings access confirmed',
        collectionCount: response.data.collection_listings.length
      }
    } else {
      return {
        success: false,
        message: 'Cannot access collections'
      }
    }
  } catch (error: any) {
    let errorMessage = 'Collections access failed'
    
    if (error.response) {
      const status = error.response.status
      switch (status) {
        case 401:
          errorMessage = 'Invalid access token for collections'
          break
        case 403:
          errorMessage = 'Access token does not have collection_listings permissions'
          break
        case 404:
          errorMessage = 'Collections endpoint not found'
          break
        case 429:
          errorMessage = 'Rate limit exceeded for collections'
          break
        default:
          errorMessage = `HTTP ${status}: ${error.response.data?.message || 'Unknown error'}`
      }
    }

    return {
      success: false,
      message: `${errorMessage}: ${error.message}`
    }
  }
}

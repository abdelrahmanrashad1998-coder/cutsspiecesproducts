import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/firebase-admin'
import { db } from '@/lib/firebase-admin'
import { testShopifyConnection } from '@/lib/shopify-test'
import { createProductAdmin } from '@/lib/firestore-admin'

// CORS headers helper
function addCorsHeaders(response: NextResponse) {
  response.headers.set('Access-Control-Allow-Origin', '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
  return response
}

// Handle preflight requests
export async function OPTIONS() {
  return addCorsHeaders(new NextResponse(null, { status: 200 }))
}

async function verifyAuthToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('No authorization token provided')
  }
  
  const token = authHeader.split('Bearer ')[1]
  if (!auth) {
    throw new Error('Firebase Admin SDK not initialized')
  }
  const decodedToken = await auth.verifyIdToken(token)
  return decodedToken
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shopId: string }> }
) {
  console.log('=== PRODUCT GET ENDPOINT CALLED ===')
  console.log('Request URL:', request.url)
  
  try {
    const decodedToken = await verifyAuthToken(request)
    const userId = decodedToken.uid
    const { shopId } = await params

    console.log('GET request processed:', { shopId, userId })

    // Check if database is initialized
    if (!db) {
      const errorResponse = NextResponse.json(
        { error: 'Database not initialized', message: 'Firebase Admin SDK not properly configured' },
        { status: 500 }
      )
      return addCorsHeaders(errorResponse)
    }

    // Verify the shop belongs to the user
    const shopDoc = await db.collection('shops').doc(shopId).get()
    if (!shopDoc.exists) {
      const errorResponse = NextResponse.json(
        { error: 'Shop not found' },
        { status: 404 }
      )
      return addCorsHeaders(errorResponse)
    }

    const shopData = shopDoc.data()
    if (shopData?.userId !== userId) {
      const errorResponse = NextResponse.json(
        { error: 'Unauthorized access to shop' },
        { status: 403 }
      )
      return addCorsHeaders(errorResponse)
    }

    // Fetch products from Shopify using the shop's credentials
    const shopifyDomain = shopData.shopifyDomain
    const accessToken = shopData.shopifyAccessToken

    if (!shopifyDomain || !accessToken) {
      const errorResponse = NextResponse.json(
        { error: 'Shop credentials not found' },
        { status: 400 }
      )
      return addCorsHeaders(errorResponse)
    }

    // Make request to Shopify API
    const shopifyResponse = await fetch(`https://${shopifyDomain}/admin/api/2024-01/products.json`, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    })

    if (!shopifyResponse.ok) {
      const errorData = await shopifyResponse.text()
      console.error('Shopify API error:', errorData)
      return NextResponse.json(
        { error: 'Failed to fetch products from Shopify', details: errorData },
        { status: shopifyResponse.status }
      )
    }

    const data = await shopifyResponse.json()
    let products = data.products || []

    // Try to get collections data using a simple GraphQL query
    try {
      const graphqlUrl = `https://${shopifyDomain}/admin/api/2023-10/graphql.json`
      const graphqlQuery = {
        query: `
          query getProductCollections {
            products(first: 50) {
              edges {
                node {
                  id
                  collections(first: 10) {
                    edges {
                      node {
                        id
                        title
                        handle
                      }
                    }
                  }
                }
              }
            }
          }
        `
      }
      
      const graphqlResponse = await fetch(graphqlUrl, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(graphqlQuery)
      })

      if (graphqlResponse.ok) {
        const graphqlData = await graphqlResponse.json()
        
        if (graphqlData.data?.products?.edges) {
          // Create a map of product ID to collections
          const productCollectionsMap: { [productId: string]: any[] } = {}
          
          graphqlData.data.products.edges.forEach((edge: any) => {
            const productId = parseInt(edge.node.id.split('/').pop()) || 0
            const collections = edge.node.collections.edges.map((cEdge: any) => ({
              id: parseInt(cEdge.node.id.split('/').pop()) || 0,
              title: cEdge.node.title,
              handle: cEdge.node.handle
            }))
            
            if (collections.length > 0) {
              productCollectionsMap[productId] = collections
            }
          })

          // Add collections data to products
          products = products.map((product: any) => ({
            ...product,
            collections: productCollectionsMap[product.id] || []
          }))
        }
      }
    } catch (error) {
      console.warn('Failed to fetch collections via GraphQL, continuing without collections:', error)
      // Add empty collections array to products
      products = products.map((product: any) => ({
        ...product,
        collections: []
      }))
    }

    // Determine currency - if not stored, fetch from Shopify
    let currency = shopData.currency
    if (!currency && shopifyDomain && accessToken) {
      try {
        const connectionTest = await testShopifyConnection(shopifyDomain, accessToken)
        if (connectionTest.success && connectionTest.shopInfo?.currency) {
          currency = connectionTest.shopInfo.currency
          // Optionally update the shop document with the currency
          await db.collection('shops').doc(shopId).update({
            currency: currency
          })
        }
      } catch (error) {
        console.log('Failed to fetch currency from Shopify:', error)
      }
    }

    const response = NextResponse.json({ 
      products,
      shop: {
        id: shopId,
        name: shopData.shopName || shopData.shopifyDomain,
        domain: shopData.shopifyDomain,
        currency: currency || 'USD'
      }
    })
    return addCorsHeaders(response)

  } catch (error: any) {
    console.error('Error fetching shop products:', error)
    
    if (error.message === 'No authorization token provided') {
      const errorResponse = NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
      return addCorsHeaders(errorResponse)
    }
    
    // Handle Firebase initialization errors
    if (error.message === 'Firebase Admin SDK not initialized') {
      return NextResponse.json(
        { 
          error: 'Firebase not configured', 
          message: 'Firebase Admin SDK is not properly initialized. Please check your environment variables.',
          details: 'Check FIREBASE_ADMIN_PRIVATE_KEY and other Firebase configuration variables.'
        },
        { status: 500 }
      )
    }
    
      const errorResponse = NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
      return addCorsHeaders(errorResponse)
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ shopId: string }> }
) {
  console.log('=== PRODUCT CREATION ENDPOINT CALLED ===')
  console.log('Request URL:', request.url)
  console.log('Request method:', request.method)
  
  try {
    console.log('Step 1: Verifying auth token...')
    const decodedToken = await verifyAuthToken(request)
    const userId = decodedToken.uid
    console.log('Step 2: Getting params...')
    const { shopId } = await params
    console.log('Step 3: Parsing request JSON...')
    const productData = await request.json()
    
    console.log('Request processed successfully:', { shopId, userId, productTitle: productData.title })

    // Validate required fields
    console.log('Step 4: Validating required fields...')
    if (!productData.title || !productData.body_html) {
      console.log('Validation failed: missing title or body_html')
      const response = NextResponse.json(
        { error: 'Title and description are required' },
        { status: 400 }
      )
      return addCorsHeaders(response)
    }

    // Verify the shop belongs to the user
    console.log('Step 5: Checking database connection...')
    if (!db) {
      console.log('Database not initialized')
      const response = NextResponse.json(
        { error: 'Database not initialized' },
        { status: 500 }
      )
      return addCorsHeaders(response)
    }
    console.log('Step 6: Fetching shop document...')
    const shopDoc = await db.collection('shops').doc(shopId).get()
    
    console.log('Step 7: Checking if shop exists...')
    if (!shopDoc.exists) {
      console.log('Shop not found for ID:', shopId)
      const response = NextResponse.json(
        { error: 'Shop not found' },
        { status: 404 }
      )
      return addCorsHeaders(response)
    }

    console.log('Step 8: Verifying shop ownership...')
    const shopData = shopDoc.data()
    if (shopData?.userId !== userId) {
      console.log('Unauthorized access - userId mismatch')
      const response = NextResponse.json(
        { error: 'Unauthorized access to shop' },
        { status: 403 }
      )
      return addCorsHeaders(response)
    }

    // Get shop credentials
    console.log('Step 9: Getting shop credentials...')
    const shopifyDomain = shopData.shopifyDomain
    const accessToken = shopData.shopifyAccessToken

    if (!shopifyDomain || !accessToken) {
      console.log('Missing shop credentials:', { hasDomain: !!shopifyDomain, hasToken: !!accessToken })
      const response = NextResponse.json(
        { error: 'Shop credentials not found' },
        { status: 400 }
      )
      return addCorsHeaders(response)
    }

    // Clean up the product data for Shopify API - replace null values with defaults
    console.log('Step 10: Cleaning product data...')
    const cleanedProductData = {
      ...productData,
      variants: productData.variants?.map((variant: any) => {
        const cleanedVariant = { ...variant }
        // Replace null values with appropriate defaults
        if (cleanedVariant.inventory_management === null) {
          cleanedVariant.inventory_management = 'shopify'
        }
        if (cleanedVariant.option1 === null || cleanedVariant.option1 === '') {
          cleanedVariant.option1 = 'Default'
        }
        if (cleanedVariant.option2 === null || cleanedVariant.option2 === '') {
          cleanedVariant.option2 = 'Default'
        }
        if (cleanedVariant.option3 === null || cleanedVariant.option3 === '') {
          cleanedVariant.option3 = 'Default'
        }
        return cleanedVariant
      }) || []
    }
    console.log('Cleaned product data:', JSON.stringify(cleanedProductData, null, 2))

    // Create product in Shopify using GraphQL API (with REST fallback)
    console.log('Step 11: Setting up API URLs...')
    const graphqlUrl = `https://${shopifyDomain}/admin/api/2024-10/graphql.json`
    const restUrl = `https://${shopifyDomain}/admin/api/2024-01/products.json`
    console.log('GraphQL URL:', graphqlUrl)
    console.log('REST URL:', restUrl)
    
    // Try REST API first since it's more reliable
    console.log('Step 12: Using REST API directly...')
    const restProductData = {
      product: cleanedProductData
    }
    
    console.log('REST API payload:', JSON.stringify(restProductData, null, 2))
    
    const shopifyResponse = await fetch(restUrl, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(restProductData),
    })
    
    const useGraphQL = false // Force REST API for now
    
    // Build GraphQL mutation
    const graphqlMutation = `
      mutation productCreate($product: ProductCreateInput!) {
        productCreate(product: $product) {
          product {
            id
            title
            handle
            status
          }
          userErrors {
            field
            message
          }
        }
      }
    `
    
    const graphqlVariables = {
      product: {
        title: cleanedProductData.title,
        descriptionHtml: cleanedProductData.body_html,
        vendor: cleanedProductData.vendor,
        tags: cleanedProductData.tags ? cleanedProductData.tags.split(',').map((tag: string) => tag.trim()) : [],
        productType: cleanedProductData.product_type || '',
        images: cleanedProductData.images?.map((img: any) => ({
          src: img.src
        })) || [],
        variants: cleanedProductData.variants?.map((variant: any) => {
          const variantData: any = {
            price: variant.price || '0.00'
          }
          
          // Add option1 (now has default value)
          if (variant.option1) {
            variantData.option1 = variant.option1
          }
          
          // Add option2 (now has default value)
          if (variant.option2) {
            variantData.option2 = variant.option2
          }
          
          // Add option3 (now has default value)
          if (variant.option3) {
            variantData.option3 = variant.option3
          }
          
          // Add inventory management (now has default value)
          if (variant.inventory_management) {
            variantData.inventoryManagement = variant.inventory_management
          }
          
          return variantData
        }) || [{
          price: '0.00',
          option1: 'Default',
          inventoryManagement: 'shopify'
        }]
      }
    }

    console.log('Creating product in Shopify:', productData.title)
    console.log('GraphQL variables:', JSON.stringify(graphqlVariables, null, 2))
    
    // Ensure we have a response
    if (!shopifyResponse) {
      const errorResponse = NextResponse.json(
        { error: 'Failed to get response from Shopify' },
        { status: 500 }
      )
      return addCorsHeaders(errorResponse)
    }

    console.log('Shopify response status:', shopifyResponse.status)

    if (!shopifyResponse.ok) {
      const errorData = await shopifyResponse.text()
      console.error('Shopify error:', shopifyResponse.status, errorData)
      console.error('API used:', useGraphQL ? 'GraphQL' : 'REST')
      
      const errorResponse = NextResponse.json(
        { error: 'Failed to create product in Shopify', details: errorData },
        { status: shopifyResponse.status }
      )
      return addCorsHeaders(errorResponse)
    }

    const shopifyResponseData = await shopifyResponse.json()
    console.log('Shopify REST API response:', JSON.stringify(shopifyResponseData, null, 2))
    
    // Handle REST response
    console.log('REST API response structure:', JSON.stringify(shopifyResponseData, null, 2))
    
    // Check if response has 'product' or 'products' array
    let shopifyProduct = null
    if (shopifyResponseData.product) {
      shopifyProduct = shopifyResponseData.product
      console.log('Found product in response:', shopifyProduct)
    } else if (shopifyResponseData.products && Array.isArray(shopifyResponseData.products) && shopifyResponseData.products.length > 0) {
      shopifyProduct = shopifyResponseData.products[0]
      console.log('Using first product from products array:', shopifyProduct)
    }
    
    if (!shopifyProduct || !shopifyProduct.id) {
      console.error('REST API: No product created. Response structure:', shopifyResponseData)
      const errorResponse = NextResponse.json(
        { error: 'Product creation failed - no product ID returned from Shopify', details: shopifyResponseData },
        { status: 500 }
      )
      return addCorsHeaders(errorResponse)
    }
    
    const productId = shopifyProduct.id
    const finalProductData = shopifyProduct

    console.log('Product created successfully in Shopify with ID:', productId)
    console.log('API used: REST')

    const response = NextResponse.json({ 
      success: true,
      product: finalProductData,
      message: 'Product created successfully',
      apiUsed: 'REST'
    })
    return addCorsHeaders(response)
  } catch (error: any) {
    console.error('=== ERROR IN PRODUCT CREATION ===')
    console.error('Error type:', typeof error)
    console.error('Error message:', error.message)
    console.error('Error stack:', error.stack)
    console.error('Full error object:', JSON.stringify(error, null, 2))
    
    if (error.message === 'No authorization token provided') {
      console.log('Authentication error - no token provided')
      const response = NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
      return addCorsHeaders(response)
    }
    
    console.log('Returning 500 error response')
    const response = NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'An unexpected error occurred while creating the product',
        details: error.message,
        stack: error.stack
      },
      { status: 500 }
    )
    return addCorsHeaders(response)
  }
}

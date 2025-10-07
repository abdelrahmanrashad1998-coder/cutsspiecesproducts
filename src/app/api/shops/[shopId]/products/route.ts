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
  
  if (!auth) {
    throw new Error('Firebase Admin SDK not initialized')
  }
  
  const token = authHeader.split('Bearer ')[1]
  const decodedToken = await auth.verifyIdToken(token)
  return decodedToken
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shopId: string }> }
) {
  try {
    const decodedToken = await verifyAuthToken(request)
    const userId = decodedToken.uid
    const { shopId } = await params

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
  try {
    console.log('Starting product creation process...')
    
    const decodedToken = await verifyAuthToken(request)
    const userId = decodedToken.uid
    const { shopId } = await params
    const productData = await request.json()
    
    console.log('Product creation request:', {
      userId,
      shopId,
      productTitle: productData.title,
      hasImages: productData.images?.length > 0,
      imageCount: productData.images?.length || 0,
      variantCount: productData.variants?.length || 0
    })

    // Check if database is initialized
    if (!db) {
      console.error('Database not initialized for product creation')
      const errorResponse = NextResponse.json(
        { error: 'Database not initialized', message: 'Firebase Admin SDK not properly configured' },
        { status: 500 }
      )
      return addCorsHeaders(errorResponse)
    }

    // Validate required fields
    if (!productData.title || !productData.body_html) {
      return NextResponse.json(
        { error: 'Title and description are required' },
        { status: 400 }
      )
    }

    // Verify the shop belongs to the user
    console.log('Fetching shop data from Firestore...')
    const shopDoc = await db.collection('shops').doc(shopId).get()
    if (!shopDoc.exists) {
      console.error('Shop not found in Firestore:', shopId)
      const errorResponse = NextResponse.json(
        { error: 'Shop not found' },
        { status: 404 }
      )
      return addCorsHeaders(errorResponse)
    }

    const shopData = shopDoc.data()
    if (shopData?.userId !== userId) {
      console.error('Unauthorized access to shop:', { shopUserId: shopData?.userId, requestUserId: userId })
      const errorResponse = NextResponse.json(
        { error: 'Unauthorized access to shop' },
        { status: 403 }
      )
      return addCorsHeaders(errorResponse)
    }

    // Get shop credentials
    const shopifyDomain = shopData.shopifyDomain
    const accessToken = shopData.shopifyAccessToken

    console.log('Shop credentials:', {
      domain: shopifyDomain,
      hasAccessToken: !!accessToken,
      accessTokenLength: accessToken?.length || 0
    })

    if (!shopifyDomain || !accessToken) {
      console.error('Missing shop credentials:', { shopifyDomain, hasAccessToken: !!accessToken })
      const errorResponse = NextResponse.json(
        { error: 'Shop credentials not found' },
        { status: 400 }
      )
      return addCorsHeaders(errorResponse)
    }

    // Create product in Shopify using shop-specific credentials
    const shopifyUrl = `https://${shopifyDomain}/admin/api/2024-01/products.json`
    console.log('Creating product in Shopify:', { url: shopifyUrl, productTitle: productData.title })
    
    const shopifyResponse = await fetch(shopifyUrl, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        product: productData
      }),
    })

    console.log('Shopify response status:', shopifyResponse.status)

    if (!shopifyResponse.ok) {
      const errorData = await shopifyResponse.text()
      console.error('Shopify create product error:', {
        status: shopifyResponse.status,
        statusText: shopifyResponse.statusText,
        error: errorData
      })
      const errorResponse = NextResponse.json(
        { error: 'Failed to create product in Shopify', details: errorData },
        { status: shopifyResponse.status }
      )
      return addCorsHeaders(errorResponse)
    }

    const shopifyProduct = await shopifyResponse.json()
    console.log('Product created successfully in Shopify:', { productId: shopifyProduct.product?.id })
    
    // Save product to Firestore for local tracking
    console.log('Saving product to Firestore...')
    
    // Extract price from first variant if available
    const firstVariant = shopifyProduct.product.variants?.[0]
    const price = firstVariant ? parseFloat(firstVariant.price) || 0 : 0
    
    // Extract image URLs from Shopify product
    const imageUrls = shopifyProduct.product.images?.map((img: any) => img.src) || []
    
    let firestoreProduct = null
    try {
      firestoreProduct = await createProductAdmin({
        shopifyId: shopifyProduct.product.id.toString(),
        title: shopifyProduct.product.title,
        description: shopifyProduct.product.body_html,
        category: shopifyProduct.product.product_type,
        images: imageUrls,
        variants: shopifyProduct.product.variants || [],
        userId: userId,
        shopId: shopId,
        price: price
      })
      
      console.log('Product saved to Firestore:', { firestoreId: firestoreProduct.id })
    } catch (firestoreError) {
      console.error('Failed to save product to Firestore:', firestoreError)
      // Continue with success response since Shopify product was created successfully
      console.log('Continuing despite Firestore error - Shopify product was created successfully')
    }

    const response = NextResponse.json({ 
      success: true,
      product: {
        id: shopifyProduct.product.id,
        ...shopifyProduct.product,
        firestoreId: firestoreProduct?.id || null
      }
    })
    console.log('Product creation completed successfully')
    return addCorsHeaders(response)
  } catch (error) {
    console.error('Error creating product:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    console.error('Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      code: (error as any)?.code || 'UNKNOWN',
      status: (error as any)?.status,
      response: (error as any)?.response
    })
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('No valid authorization token')) {
        const errorResponse = NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        )
        return addCorsHeaders(errorResponse)
      }
      
      // Handle Firebase initialization errors
      if (error.message === 'Firebase Admin SDK not initialized') {
        const errorResponse = NextResponse.json(
          { 
            error: 'Firebase not configured', 
            message: 'Firebase Admin SDK is not properly initialized. Please check your environment variables.',
            details: 'Check FIREBASE_ADMIN_PRIVATE_KEY and other Firebase configuration variables.'
          },
          { status: 500 }
        )
        return addCorsHeaders(errorResponse)
      }
      
      // Handle Firestore connection errors
      if (error.message.includes('DECODER routines::unsupported') || (error as any).code === 2) {
        const errorResponse = NextResponse.json(
          { 
            error: 'Firebase connection error', 
            message: 'Unable to connect to Firebase. Please check your Firebase configuration.',
            details: 'This is likely a Firebase Admin SDK private key formatting issue.'
          },
          { status: 500 }
        )
        return addCorsHeaders(errorResponse)
      }
      
      if (error.message.includes('Shopify')) {
        const errorResponse = NextResponse.json(
          { error: 'Failed to create product in Shopify', details: error.message },
          { status: 500 }
        )
        return addCorsHeaders(errorResponse)
      }
      
      if (error.message.includes('Firebase') || error.message.includes('Firestore')) {
        const errorResponse = NextResponse.json(
          { error: 'Database connection error', details: error.message },
          { status: 500 }
        )
        return addCorsHeaders(errorResponse)
      }
    }
    
    const errorResponse = NextResponse.json(
      { 
        error: 'Failed to create product',
        details: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
    return addCorsHeaders(errorResponse)
  }
}

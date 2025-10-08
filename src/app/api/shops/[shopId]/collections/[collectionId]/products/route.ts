import { NextRequest, NextResponse } from 'next/server'
import { auth, db } from '@/lib/firebase-admin'

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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ shopId: string; collectionId: string }> }
) {
  try {
    const decodedToken = await verifyAuthToken(request)
    const userId = decodedToken.uid
    const { shopId, collectionId } = await params
    const { productId } = await request.json()

    if (!productId) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      )
    }

    // Verify the shop belongs to the user
    if (!db) {
      return NextResponse.json(
        { error: 'Database not initialized' },
        { status: 500 }
      )
    }

    const shopDoc = await db.collection('shops').doc(shopId).get()
    
    if (!shopDoc.exists) {
      const response = NextResponse.json(
        { error: 'Shop not found' },
        { status: 404 }
      )
      return addCorsHeaders(response)
    }

    const shopData = shopDoc.data()
    
    if (shopData?.userId !== userId) {
      const response = NextResponse.json(
        { error: 'Unauthorized access to shop' },
        { status: 403 }
      )
      return addCorsHeaders(response)
    }

    // Get shop credentials
    let shopifyDomain = shopData.shopifyDomain
    const accessToken = shopData.shopifyAccessToken

    if (!shopifyDomain || !accessToken) {
      const response = NextResponse.json(
        { error: 'Shop credentials not found' },
        { status: 400 }
      )
      return addCorsHeaders(response)
    }

    // Convert custom domain to myshopify domain if needed
    if (shopifyDomain === 'cutts-pieces.com') {
      shopifyDomain = 'v4b0fh-da.myshopify.com'
    }

    // Convert product ID to GID format if it's a plain integer
    let productGid = productId
    if (!productId.startsWith('gid://')) {
      productGid = `gid://shopify/Product/${productId}`
    }

    // Convert collection ID to GID format if it's a plain integer
    let collectionGid = collectionId
    if (!collectionId.startsWith('gid://')) {
      collectionGid = `gid://shopify/Collection/${collectionId}`
    }

    // Add product to collection using GraphQL API
    const graphqlUrl = `https://${shopifyDomain}/admin/api/2025-10/graphql.json`
    
    console.log('========== ADDING PRODUCT TO COLLECTION ==========')
    console.log('Product GID:', productGid)
    console.log('Collection GID:', collectionGid)
    console.log('GraphQL URL:', graphqlUrl)
    console.log('==================================================')
    
    const collectionMutation = `
      mutation collectionAddProducts($id: ID!, $productIds: [ID!]!) {
        collectionAddProducts(id: $id, productIds: $productIds) {
          collection {
            id
            title
            productsCount {
              count
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `
    
    const requestBody = {
      query: collectionMutation,
      variables: {
        id: collectionGid,
        productIds: [productGid]
      }
    }
    
    console.log('Request body:', JSON.stringify(requestBody, null, 2))
    
    const shopifyResponse = await fetch(graphqlUrl, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })
    
    console.log('Collection API response status:', shopifyResponse.status)
    console.log('Collection API response headers:', Object.fromEntries(shopifyResponse.headers.entries()))

    if (!shopifyResponse.ok) {
      const errorData = await shopifyResponse.text()
      console.error('❌ Shopify collection API HTTP error:', shopifyResponse.status, errorData)
      
      const errorResponse = NextResponse.json(
        { 
          error: 'Failed to add product to collection', 
          details: errorData,
          statusCode: shopifyResponse.status,
          request: {
            collectionGid,
            productGid,
            graphqlUrl
          }
        },
        { status: shopifyResponse.status }
      )
      return addCorsHeaders(errorResponse)
    }

    const data = await shopifyResponse.json()
    console.log('✅ Collection API response:', JSON.stringify(data, null, 2))
    
    // Check for GraphQL errors
    if (data.errors) {
      console.error('GraphQL errors:', data.errors)
      const errorResponse = NextResponse.json(
        { error: 'Failed to add product to collection', details: data.errors },
        { status: 400 }
      )
      return addCorsHeaders(errorResponse)
    }
    
    // Check for user errors
    const result = data.data?.collectionAddProducts
    if (result?.userErrors && result.userErrors.length > 0) {
      console.error('User errors:', result.userErrors)
      const errorResponse = NextResponse.json(
        { error: 'Failed to add product to collection', details: result.userErrors },
        { status: 400 }
      )
      return addCorsHeaders(errorResponse)
    }
    
    console.log('Product added to collection successfully:', result?.collection)
    
    const response = NextResponse.json({ 
      success: true,
      message: 'Product added to collection successfully',
      collection: result?.collection,
      data: result
    })
    return addCorsHeaders(response)

  } catch (error: any) {
    console.error('Error adding product to collection:', error)
    
    if (error.message === 'No authorization token provided') {
      const response = NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
      return addCorsHeaders(response)
    }
    
    const response = NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'An unexpected error occurred while adding product to collection',
        details: error.message
      },
      { status: 500 }
    )
    return addCorsHeaders(response)
  }
}

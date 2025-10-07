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
    const shopifyDomain = shopData.shopifyDomain
    const accessToken = shopData.shopifyAccessToken

    if (!shopifyDomain || !accessToken) {
      const response = NextResponse.json(
        { error: 'Shop credentials not found' },
        { status: 400 }
      )
      return addCorsHeaders(response)
    }

    // Add product to collection using Shopify API
    // Use the correct Shopify API endpoint for adding products to collections
    const shopifyUrl = `https://${shopifyDomain}/admin/api/2024-01/collects.json`
    
    console.log('Adding product to collection:', { productId, collectionId, shopifyUrl })
    
    const shopifyResponse = await fetch(shopifyUrl, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        collect: {
          product_id: parseInt(productId),
          collection_id: parseInt(collectionId)
        }
      }),
    })
    
    console.log('Collection API response status:', shopifyResponse.status)

    if (!shopifyResponse.ok) {
      const errorData = await shopifyResponse.text()
      console.error('Shopify collection API error:', shopifyResponse.status, errorData)
      
      const errorResponse = NextResponse.json(
        { error: 'Failed to add product to collection', details: errorData },
        { status: shopifyResponse.status }
      )
      return addCorsHeaders(errorResponse)
    }

    const data = await shopifyResponse.json()
    console.log('Product added to collection successfully:', data)
    
    const response = NextResponse.json({ 
      success: true,
      message: 'Product added to collection successfully',
      data
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

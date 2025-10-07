import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/firebase-admin'
import { db } from '@/lib/firebase-admin'
import { testShopifyConnection } from '@/lib/shopify-test'

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

// Update shop
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ shopId: string }> }
) {
  try {
    const decodedToken = await verifyAuthToken(request)
    const userId = decodedToken.uid
    const { shopId } = await params

    // Check if database is initialized
    if (!db) {
      const response = NextResponse.json(
        { error: 'Database not initialized', message: 'Firebase Admin SDK not properly configured' },
        { status: 500 }
      )
      return addCorsHeaders(response)
    }

    // Verify the shop belongs to the user
    const shopDoc = await db.collection('shops').doc(shopId).get()
    if (!shopDoc.exists) {
      const response = NextResponse.json(
        { error: 'Shop not found' },
        { status: 404 }
      )
      return addCorsHeaders(response)
    }

    const existingShopData = shopDoc.data()
    if (existingShopData?.userId !== userId) {
      const response = NextResponse.json(
        { error: 'Unauthorized access to shop' },
        { status: 403 }
      )
      return addCorsHeaders(response)
    }

    const { 
      shopifyDomain, 
      shopifyAccessToken,
      shopName,
      shopEmail,
      storeDescription 
    } = await request.json()

    if (!shopifyDomain) {
      return NextResponse.json(
        { error: 'Shopify domain is required' },
        { status: 400 }
      )
    }

    // Use existing access token if new one not provided
    const accessTokenToUse = shopifyAccessToken || existingShopData.shopifyAccessToken

    // Test the connection if access token is provided
    let connectionTest = null
    if (shopifyAccessToken) {
      connectionTest = await testShopifyConnection(shopifyDomain, shopifyAccessToken)
      
      if (!connectionTest.success) {
        return NextResponse.json(
          { 
            error: 'Connection test failed', 
            details: connectionTest.message 
          },
          { status: 400 }
        )
      }
    }

    // Update the shop
      const updatedShopData = {
        ...existingShopData,
        shopifyDomain,
        shopifyAccessToken: accessTokenToUse,
        shopName: shopName || connectionTest?.shopInfo?.name || existingShopData.shopName,
        shopEmail: shopEmail || connectionTest?.shopInfo?.email || existingShopData.shopEmail,
        storeDescription: storeDescription !== undefined ? storeDescription : existingShopData.storeDescription,
        currency: connectionTest?.shopInfo?.currency || existingShopData.currency,
        updatedAt: new Date()
      }

    await db.collection('shops').doc(shopId).set(updatedShopData)

    const response = NextResponse.json({ 
      shop: updatedShopData,
      connectionTest: connectionTest ? {
        success: true,
        message: 'Connection test successful',
        shopInfo: connectionTest.shopInfo
      } : null
    })
    return addCorsHeaders(response)

  } catch (error: any) {
    console.error('Error updating shop:', error)
    
    if (error.message === 'No authorization token provided') {
      const response = NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
      return addCorsHeaders(response)
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
    
      const response = NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
      return addCorsHeaders(response)
  }
}

// Delete shop
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ shopId: string }> }
) {
  try {
    const decodedToken = await verifyAuthToken(request)
    const userId = decodedToken.uid
    const { shopId } = await params

    // Check if database is initialized
    if (!db) {
      const response = NextResponse.json(
        { error: 'Database not initialized', message: 'Firebase Admin SDK not properly configured' },
        { status: 500 }
      )
      return addCorsHeaders(response)
    }

    // Verify the shop belongs to the user
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

    // Delete the shop
    await db.collection('shops').doc(shopId).delete()

    const response = NextResponse.json({ 
      message: 'Shop deleted successfully' 
    })
    return addCorsHeaders(response)

  } catch (error: any) {
    console.error('Error deleting shop:', error)
    
    if (error.message === 'No authorization token provided') {
      const response = NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
      return addCorsHeaders(response)
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
    
      const response = NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
      return addCorsHeaders(response)
  }
}

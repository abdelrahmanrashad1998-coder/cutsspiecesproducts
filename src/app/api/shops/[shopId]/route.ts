import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/firebase-admin'
import { db } from '@/lib/firebase-admin'
import { testShopifyConnection } from '@/lib/shopify-test'

async function verifyAuthToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('No authorization token provided')
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

    // Verify the shop belongs to the user
    const shopDoc = await db.collection('shops').doc(shopId).get()
    if (!shopDoc.exists) {
      return NextResponse.json(
        { error: 'Shop not found' },
        { status: 404 }
      )
    }

    const existingShopData = shopDoc.data()
    if (existingShopData?.userId !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized access to shop' },
        { status: 403 }
      )
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

    return NextResponse.json({ 
      shop: updatedShopData,
      connectionTest: connectionTest ? {
        success: true,
        message: 'Connection test successful',
        shopInfo: connectionTest.shopInfo
      } : null
    })

  } catch (error: any) {
    console.error('Error updating shop:', error)
    
    if (error.message === 'No authorization token provided') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
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

    // Verify the shop belongs to the user
    const shopDoc = await db.collection('shops').doc(shopId).get()
    if (!shopDoc.exists) {
      return NextResponse.json(
        { error: 'Shop not found' },
        { status: 404 }
      )
    }

    const shopData = shopDoc.data()
    if (shopData?.userId !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized access to shop' },
        { status: 403 }
      )
    }

    // Delete the shop
    await db.collection('shops').doc(shopId).delete()

    return NextResponse.json({ 
      message: 'Shop deleted successfully' 
    })

  } catch (error: any) {
    console.error('Error deleting shop:', error)
    
    if (error.message === 'No authorization token provided') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

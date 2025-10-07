import { NextRequest, NextResponse } from 'next/server'
import { auth, db } from '@/lib/firebase-admin'

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

export async function GET(request: NextRequest) {
  try {
    const decodedToken = await verifyAuthToken(request)
    const userId = decodedToken.uid

    if (!db) {
      return NextResponse.json({
        error: 'Database not initialized',
        userId,
        timestamp: new Date().toISOString()
      }, { status: 500 })
    }

    // Get all shops for this user
    const userShopsQuery = await db.collection('shops').where('userId', '==', userId).get()
    const userShops = userShopsQuery.docs.map(doc => ({ 
      id: doc.id, 
      shopName: doc.data().shopName,
      shopifyDomain: doc.data().shopifyDomain,
      userId: doc.data().userId,
      isActive: doc.data().isActive
    }))

    return NextResponse.json({
      userId,
      shopCount: userShops.length,
      shops: userShops,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    return NextResponse.json({
      error: 'Failed to fetch user shops',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const decodedToken = await verifyAuthToken(request)
    const userId = decodedToken.uid
    const { shopId } = await request.json()

    if (!db) {
      return NextResponse.json({
        error: 'Database not initialized',
        userId,
        timestamp: new Date().toISOString()
      }, { status: 500 })
    }

    if (!shopId) {
      return NextResponse.json({
        error: 'Shop ID is required',
        timestamp: new Date().toISOString()
      }, { status: 400 })
    }

    // Get specific shop details
    const shopDoc = await db.collection('shops').doc(shopId).get()
    
    if (!shopDoc.exists) {
      return NextResponse.json({
        error: 'Shop not found',
        shopId,
        timestamp: new Date().toISOString()
      }, { status: 404 })
    }

    const shopData = shopDoc.data()
    const hasAccess = shopData?.userId === userId

    return NextResponse.json({
      userId,
      shopId,
      hasAccess,
      shopDetails: {
        id: shopId,
        shopName: shopData?.shopName,
        shopifyDomain: shopData?.shopifyDomain,
        userId: shopData?.userId,
        isActive: shopData?.isActive,
        createdAt: shopData?.createdAt,
        updatedAt: shopData?.updatedAt
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    return NextResponse.json({
      error: 'Failed to check shop ownership',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

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

    console.log('=== INSPECTING SHOPS FOR USER:', userId, '===')

    // Get all shops for this user
    const userShopsQuery = await db.collection('shops').where('userId', '==', userId).get()
    const userShops = userShopsQuery.docs.map(doc => {
      const data = doc.data()
      return {
        firebaseDocId: doc.id,
        userId: data.userId,
        shopifyDomain: data.shopifyDomain,
        shopName: data.shopName,
        isActive: data.isActive,
        createdAt: data.createdAt,
        hasAccessToken: !!data.shopifyAccessToken,
        hasWebhookSecret: !!data.webhookSecret,
        allFields: Object.keys(data)
      }
    })

    console.log('User shops found:', userShops)

    // Also get ALL shops (for debugging - remove in production)
    const allShopsQuery = await db.collection('shops').limit(10).get()
    const allShops = allShopsQuery.docs.map(doc => {
      const data = doc.data()
      return {
        firebaseDocId: doc.id,
        userId: data.userId,
        shopifyDomain: data.shopifyDomain,
        shopName: data.shopName,
        isActive: data.isActive
      }
    })

    return NextResponse.json({
      userId,
      userShopsCount: userShops.length,
      userShops: userShops,
      debugInfo: {
        totalShopsInDatabase: allShops.length,
        allShops: allShops,
        firebaseAdminStatus: {
          auth: !!auth,
          db: !!db
        }
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error inspecting shops:', error)
    return NextResponse.json({
      error: 'Failed to inspect shops',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

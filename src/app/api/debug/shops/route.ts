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
      ...doc.data(),
      // Remove sensitive data
      shopifyAccessToken: doc.data()?.shopifyAccessToken ? '***hidden***' : undefined
    }))

    return NextResponse.json({
      userId,
      shopCount: userShops.length,
      shops: userShops,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    return NextResponse.json({
      error: 'Failed to fetch shops',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
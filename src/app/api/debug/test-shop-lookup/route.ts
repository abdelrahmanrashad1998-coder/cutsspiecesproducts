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

    console.log('=== TESTING SHOP LOOKUP ===')
    console.log('User ID:', userId)
    console.log('Shop ID to lookup:', shopId)

    const results: any = {
      userId,
      requestedShopId: shopId,
      lookups: {}
    }

    // Test 1: Direct document lookup
    console.log('Test 1: Direct document lookup by ID')
    const directDoc = await db.collection('shops').doc(shopId).get()
    results.lookups.directDocument = {
      exists: directDoc.exists,
      data: directDoc.exists ? directDoc.data() : null,
      docId: directDoc.id
    }

    // Test 2: Query by shopifyDomain
    console.log('Test 2: Query by shopifyDomain')
    const domainQuery = await db.collection('shops').where('shopifyDomain', '==', shopId).get()
    results.lookups.domainQuery = {
      count: domainQuery.docs.length,
      docs: domainQuery.docs.map(doc => ({
        docId: doc.id,
        data: doc.data()
      }))
    }

    // Test 3: Query by shopifyDomain AND userId
    console.log('Test 3: Query by shopifyDomain AND userId')
    const domainUserQuery = await db.collection('shops').where('shopifyDomain', '==', shopId).where('userId', '==', userId).get()
    results.lookups.domainUserQuery = {
      count: domainUserQuery.docs.length,
      docs: domainUserQuery.docs.map(doc => ({
        docId: doc.id,
        data: doc.data()
      }))
    }

    // Test 4: Get all shops for this user
    console.log('Test 4: Get all shops for this user')
    const userShopsQuery = await db.collection('shops').where('userId', '==', userId).get()
    results.lookups.userShops = {
      count: userShopsQuery.docs.length,
      docs: userShopsQuery.docs.map(doc => ({
        docId: doc.id,
        shopifyDomain: doc.data().shopifyDomain,
        shopName: doc.data().shopName
      }))
    }

    // Test 5: Check if shopId matches any user's shop IDs
    const matchingShop = userShopsQuery.docs.find(doc => doc.id === shopId)
    results.lookups.matchingUserShop = matchingShop ? {
      found: true,
      docId: matchingShop.id,
      data: matchingShop.data()
    } : { found: false }

    return NextResponse.json({
      ...results,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error testing shop lookup:', error)
    return NextResponse.json({
      error: 'Failed to test shop lookup',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

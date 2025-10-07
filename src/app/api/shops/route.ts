import { NextRequest, NextResponse } from 'next/server'
import { createShopAdmin, getShopsByUserIdAdmin } from '@/lib/firestore-admin'
import { testShopifyConnection } from '@/lib/shopify-test'
import { auth, db } from '@/lib/firebase-admin'

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

export async function GET(request: NextRequest) {
  try {
    const decodedToken = await verifyAuthToken(request)
    const userId = decodedToken.uid

    // Check if database is initialized
    if (!db) {
      return NextResponse.json(
        { error: 'Database not initialized', message: 'Firebase Admin SDK not properly configured' },
        { status: 500 }
      )
    }

    const shops = await getShopsByUserIdAdmin(userId)
    return NextResponse.json({ shops })
  } catch (error: any) {
    console.error('Error fetching shops:', error)
    
    // Handle authentication errors
    if (error.message === 'No authorization token provided') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
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
    
    // Handle Firestore permission errors specifically
    if (error.code === 'permission-denied') {
      return NextResponse.json(
        { 
          error: 'Firestore security rules not deployed. Please deploy security rules in Firebase Console.',
          details: 'Go to Firebase Console → Firestore Database → Rules and deploy the security rules.'
        },
        { status: 403 }
      )
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const decodedToken = await verifyAuthToken(request)
    const userId = decodedToken.uid
    
    // Check if database is initialized
    if (!db) {
      return NextResponse.json(
        { error: 'Database not initialized', message: 'Firebase Admin SDK not properly configured' },
        { status: 500 }
      )
    }
    
    const { 
      shopifyDomain, 
      shopifyApiKey, 
      shopifyApiSecret, 
      shopifyAccessToken,
      shopName,
      shopEmail,
      storeDescription 
    } = await request.json()

    if (!shopifyDomain || !shopifyAccessToken) {
      return NextResponse.json(
        { error: 'Shopify domain and access token are required' },
        { status: 400 }
      )
    }

    // Test the connection first
    const connectionTest = await testShopifyConnection(shopifyDomain, shopifyAccessToken)
    
    if (!connectionTest.success) {
      return NextResponse.json(
        { 
          error: 'Connection test failed', 
          details: connectionTest.message 
        },
        { status: 400 }
      )
    }

    // Create the shop in Firebase
    const shop = await createShopAdmin({
      userId,
      shopifyDomain: connectionTest.shopInfo?.domain || shopifyDomain,
      shopifyApiKey: shopifyApiKey || '',
      shopifyApiSecret: shopifyApiSecret || '',
      shopifyAccessToken,
      shopName: shopName || connectionTest.shopInfo?.name,
      shopEmail: shopEmail || connectionTest.shopInfo?.email,
      storeDescription: storeDescription || '',
      currency: connectionTest.shopInfo?.currency,
    })

    return NextResponse.json({ 
      shop,
      connectionTest: {
        success: true,
        message: 'Shop connected successfully',
        shopInfo: connectionTest.shopInfo
      }
    })
  } catch (error: any) {
    console.error('Error creating shop:', error)
    
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
    
    // Handle Firestore permission errors specifically
    if (error.code === 'permission-denied') {
      return NextResponse.json(
        { 
          error: 'Firestore security rules not deployed. Please deploy security rules in Firebase Console.',
          details: 'Go to Firebase Console → Firestore Database → Rules and deploy the security rules.'
        },
        { status: 403 }
      )
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

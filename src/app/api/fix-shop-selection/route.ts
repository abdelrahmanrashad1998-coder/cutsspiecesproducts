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

    console.log('Fix Shop Selection: Fetching shops for user:', userId)

    // Check if database is initialized
    if (!db) {
      const errorResponse = NextResponse.json(
        { error: 'Database not initialized', message: 'Firebase Admin SDK not properly configured' },
        { status: 500 }
      )
      return addCorsHeaders(errorResponse)
    }

    // Get all shops for this user
    const userShopsQuery = await db.collection('shops').where('userId', '==', userId).get()
    const userShops = userShopsQuery.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data(),
      // Remove sensitive data
      shopifyAccessToken: doc.data().shopifyAccessToken ? '***HIDDEN***' : null
    }))

    console.log('Fix Shop Selection: Found shops for user:', userShops)

    // Find the shop that should be used (preferably the active one)
    const activeShop = userShops.find(shop => shop.isActive) || userShops[0]

    const response = NextResponse.json({ 
      userId,
      shops: userShops,
      recommendedShop: activeShop,
      message: activeShop ? 
        `Use shop: ${activeShop.shopName || activeShop.shopifyDomain} (ID: ${activeShop.id})` :
        'No shops found for this user. Please create a shop first.',
      instructions: [
        '1. Clear your browser localStorage',
        '2. Refresh the page',
        '3. Select the recommended shop from the dropdown',
        '4. Try creating a product again'
      ]
    })
    return addCorsHeaders(response)

  } catch (error: any) {
    console.error('Error in fix shop selection endpoint:', error)
    
    if (error.message === 'No authorization token provided') {
      const errorResponse = NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
      return addCorsHeaders(errorResponse)
    }
    
    const errorResponse = NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
    return addCorsHeaders(errorResponse)
  }
}

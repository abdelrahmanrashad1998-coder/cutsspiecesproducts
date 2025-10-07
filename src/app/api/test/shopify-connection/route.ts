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

export async function POST(request: NextRequest) {
  try {
    console.log('=== SHOPIFY CONNECTION TEST ===')
    
    const decodedToken = await verifyAuthToken(request)
    const userId = decodedToken.uid
    const { shopId } = await request.json()

    console.log('Testing Shopify connection for shop:', shopId, 'user:', userId)

    if (!db) {
      const response = NextResponse.json(
        { error: 'Database not initialized' },
        { status: 500 }
      )
      return addCorsHeaders(response)
    }

    // Get shop data
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

    const shopifyDomain = shopData.shopifyDomain
    const accessToken = shopData.shopifyAccessToken

    if (!shopifyDomain || !accessToken) {
      const response = NextResponse.json(
        { error: 'Shop credentials not found' },
        { status: 400 }
      )
      return addCorsHeaders(response)
    }

    console.log('Testing Shopify API connection...')
    console.log('Domain:', shopifyDomain)
    console.log('Token length:', accessToken.length)

    // Test Shopify API connection by getting shop info
    const shopifyUrl = `https://${shopifyDomain}/admin/api/2024-01/shop.json`
    const shopifyResponse = await fetch(shopifyUrl, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    })

    console.log('Shopify API Response Status:', shopifyResponse.status)

    if (!shopifyResponse.ok) {
      const errorData = await shopifyResponse.text()
      console.error('Shopify API Error:', errorData)
      
      const response = NextResponse.json({
        success: false,
        error: 'Shopify API connection failed',
        details: {
          status: shopifyResponse.status,
          statusText: shopifyResponse.statusText,
          error: errorData,
          domain: shopifyDomain
        }
      })
      return addCorsHeaders(response)
    }

    const shopInfo = await shopifyResponse.json()
    console.log('Shopify API Success:', shopInfo.shop?.name)

    const response = NextResponse.json({
      success: true,
      message: 'Shopify connection successful',
      shopInfo: {
        name: shopInfo.shop?.name,
        domain: shopInfo.shop?.domain,
        email: shopInfo.shop?.email,
        currency: shopInfo.shop?.currency
      }
    })
    return addCorsHeaders(response)

  } catch (error: any) {
    console.error('Shopify connection test error:', error)
    
    const response = NextResponse.json({
      success: false,
      error: 'Connection test failed',
      details: error.message
    }, { status: 500 })
    
    return addCorsHeaders(response)
  }
}

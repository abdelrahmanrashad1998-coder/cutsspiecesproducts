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
    console.log('=== MINIMAL PRODUCT CREATION TEST ===')
    
    const decodedToken = await verifyAuthToken(request)
    const userId = decodedToken.uid
    const { shopId } = await request.json()

    console.log('Creating minimal product for shop:', shopId, 'user:', userId)

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

    // Create minimal product data
    const minimalProduct = {
      title: `Test Product ${Date.now()}`,
      body_html: '<p>This is a test product created by the API</p>',
      vendor: 'Test Vendor',
      product_type: 'Test',
      variants: [
        {
          price: '10.00',
          inventory_management: 'shopify'
        }
      ]
    }

    const shopifyProductData = {
      product: minimalProduct
    }

    console.log('Creating minimal product:', JSON.stringify(shopifyProductData, null, 2))

    // Create product in Shopify
    const shopifyUrl = `https://${shopifyDomain}/admin/api/2024-01/products.json`
    const shopifyResponse = await fetch(shopifyUrl, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(shopifyProductData),
    })

    console.log('Shopify Response Status:', shopifyResponse.status)

    if (!shopifyResponse.ok) {
      const errorData = await shopifyResponse.text()
      console.error('Shopify Create Error:', errorData)
      
      const response = NextResponse.json({
        success: false,
        error: 'Failed to create product in Shopify',
        details: {
          status: shopifyResponse.status,
          statusText: shopifyResponse.statusText,
          error: errorData,
          requestData: shopifyProductData
        }
      })
      return addCorsHeaders(response)
    }

    const shopifyProduct = await shopifyResponse.json()
    console.log('Product Created Successfully:', shopifyProduct.product?.id)

    const response = NextResponse.json({
      success: true,
      message: 'Minimal product created successfully',
      product: shopifyProduct.product
    })
    return addCorsHeaders(response)

  } catch (error: any) {
    console.error('Minimal product creation test error:', error)
    
    const response = NextResponse.json({
      success: false,
      error: 'Test failed',
      details: error.message
    }, { status: 500 })
    
    return addCorsHeaders(response)
  }
}

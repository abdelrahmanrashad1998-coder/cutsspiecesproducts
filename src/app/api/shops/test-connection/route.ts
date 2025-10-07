import { NextRequest, NextResponse } from 'next/server'
import { testShopifyConnection, testShopifyProductsAccess, testShopifyCollectionsAccess } from '@/lib/shopify-test'

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

export async function POST(request: NextRequest) {
  try {
    const { shopifyDomain, shopifyAccessToken } = await request.json()

    if (!shopifyDomain || !shopifyAccessToken) {
      const response = NextResponse.json(
        { error: 'Shopify domain and access token are required' },
        { status: 400 }
      )
      return addCorsHeaders(response)
    }

    // Test basic connection
    const connectionTest = await testShopifyConnection(shopifyDomain, shopifyAccessToken)
    
    if (!connectionTest.success) {
      const response = NextResponse.json({
        success: false,
        message: connectionTest.message,
        error: connectionTest.error
      })
      return addCorsHeaders(response)
    }

    // Test products access
    const productsTest = await testShopifyProductsAccess(shopifyDomain, shopifyAccessToken)
    
    // Test collections access
    const collectionsTest = await testShopifyCollectionsAccess(shopifyDomain, shopifyAccessToken)

    const response = NextResponse.json({
      success: true,
      message: 'Connection test successful',
      connectionTest,
      productsTest,
      collectionsTest,
      shopInfo: connectionTest.shopInfo
    })
    return addCorsHeaders(response)
  } catch (error) {
    console.error('Error testing connection:', error)
    const response = NextResponse.json(
      { 
        success: false,
        error: 'Internal server error' 
      },
      { status: 500 }
    )
    return addCorsHeaders(response)
  }
}

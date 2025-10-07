import { NextRequest, NextResponse } from 'next/server'
import { testShopifyConnection, testShopifyProductsAccess, testShopifyCollectionsAccess } from '@/lib/shopify-test'

export async function POST(request: NextRequest) {
  try {
    const { shopifyDomain, shopifyAccessToken } = await request.json()

    if (!shopifyDomain || !shopifyAccessToken) {
      return NextResponse.json(
        { error: 'Shopify domain and access token are required' },
        { status: 400 }
      )
    }

    // Test basic connection
    const connectionTest = await testShopifyConnection(shopifyDomain, shopifyAccessToken)
    
    if (!connectionTest.success) {
      return NextResponse.json({
        success: false,
        message: connectionTest.message,
        error: connectionTest.error
      })
    }

    // Test products access
    const productsTest = await testShopifyProductsAccess(shopifyDomain, shopifyAccessToken)
    
    // Test collections access
    const collectionsTest = await testShopifyCollectionsAccess(shopifyDomain, shopifyAccessToken)

    return NextResponse.json({
      success: true,
      message: 'Connection test successful',
      connectionTest,
      productsTest,
      collectionsTest,
      shopInfo: connectionTest.shopInfo
    })
  } catch (error) {
    console.error('Error testing connection:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error' 
      },
      { status: 500 }
    )
  }
}

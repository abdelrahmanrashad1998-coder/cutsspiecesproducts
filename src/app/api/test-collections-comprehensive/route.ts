import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/firebase-admin'
import { db } from '@/lib/firebase-admin'

async function verifyAuthToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('No authorization token provided')
  }
  
  const token = authHeader.split('Bearer ')[1]
  const decodedToken = await auth.verifyIdToken(token)
  return decodedToken
}

export async function POST(request: NextRequest) {
  try {
    const decodedToken = await verifyAuthToken(request)
    const userId = decodedToken.uid
    
    const { shopId } = await request.json()
    
    console.log('=== COMPREHENSIVE COLLECTIONS TEST ===')
    console.log('UserId:', userId, 'ShopId:', shopId)
    
    if (!shopId) {
      return NextResponse.json(
        { error: 'Shop ID is required' },
        { status: 400 }
      )
    }

    // Get shop data
    console.log('Fetching shop data...')
    const shopDoc = await db.collection('shops').doc(shopId).get()
    
    if (!shopDoc.exists) {
      return NextResponse.json(
        { 
          error: 'Shop not found',
          debug: { shopId, userId }
        },
        { status: 404 }
      )
    }
    
    const shopData = shopDoc.data()
    console.log('Shop data retrieved:', {
      shopId,
      userId: shopData?.userId,
      expectedUserId: userId,
      hasShopifyDomain: !!shopData?.shopifyDomain,
      hasAccessToken: !!shopData?.shopifyAccessToken,
      shopifyDomain: shopData?.shopifyDomain,
      accessTokenLength: shopData?.shopifyAccessToken?.length
    })
    
    if (shopData?.userId !== userId) {
      return NextResponse.json(
        { 
          error: 'User ID mismatch',
          debug: {
            shopUserId: shopData?.userId,
            requestUserId: userId
          }
        },
        { status: 403 }
      )
    }

    // Test credentials
    let shopifyDomain = shopData.shopifyDomain
    const accessToken = shopData.shopifyAccessToken
    
    if (!shopifyDomain || !accessToken) {
      return NextResponse.json(
        { 
          error: 'Missing credentials',
          debug: {
            hasDomain: !!shopifyDomain,
            hasToken: !!accessToken,
            domain: shopifyDomain,
            tokenLength: accessToken?.length
          }
        },
        { status: 400 }
      )
    }

    // Convert custom domain if needed
    if (shopifyDomain === 'cutts-pieces.com') {
      shopifyDomain = 'v4b0fh-da.myshopify.com'
      console.log('Converted domain to myshopify format')
    }

    // Test multiple endpoints with comprehensive logging
    const testResults = []
    const endpoints = [
      'https://api.shopify.com/2024-01/admin/shop.json',
      `https://${shopifyDomain}/admin/api/2024-01/shop.json`,
      `https://${shopifyDomain}/admin/api/2024-01/collection_listings.json`,
      `https://${shopifyDomain}/admin/api/2023-10/collection_listings.json`,
      `https://${shopifyDomain}/admin/api/2023-07/collection_listings.json`,
    ]

    for (const url of endpoints) {
      console.log('Testing endpoint:', url)
      
      try {
        const startTime = Date.now()
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        })
        const endTime = Date.now()
        
        const responseText = await response.text()
        let parsedData = null
        
        try {
          parsedData = JSON.parse(responseText)
        } catch (e) {
          // Response is not JSON
        }

        const result = {
          url,
          status: response.status,
          statusText: response.statusText,
          success: response.ok,
          responseTime: endTime - startTime,
          responseLength: responseText.length,
          responsePreview: responseText.substring(0, 200),
          headers: Object.fromEntries(response.headers.entries()),
          parsedData: parsedData ? {
            keys: Object.keys(parsedData),
            hasCollections: !!parsedData.collections,
            collectionsCount: parsedData.collections?.length,
            hasShop: !!parsedData.shop,
            errors: parsedData.errors
          } : null
        }
        
        testResults.push(result)
        console.log('Test result for', url, ':', result)
        
      } catch (error: any) {
        const result = {
          url,
          error: error.message,
          success: false
        }
        testResults.push(result)
        console.log('Error testing', url, ':', error.message)
      }
    }

    return NextResponse.json({
      success: true,
      debug: {
        shopData: {
          id: shopId,
          domain: shopifyDomain,
          hasToken: !!accessToken,
          tokenLength: accessToken?.length
        },
        testResults
      }
    })
    
  } catch (error: any) {
    console.error('Comprehensive test error:', error)
    return NextResponse.json(
      { 
        error: 'Test failed',
        message: error.message,
        stack: error.stack
      },
      { status: 500 }
    )
  }
}

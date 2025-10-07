import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/firebase-admin'
import { db } from '@/lib/firebase-admin'

export async function POST(request: NextRequest) {
  try {
    // Get auth token
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'No authorization token provided' },
        { status: 401 }
      )
    }
    
    const token = authHeader.split('Bearer ')[1]
    const decodedToken = await auth.verifyIdToken(token)
    const userId = decodedToken.uid
    
    const { shopId } = await request.json()
    
    console.log('Debug collections request:', { shopId, userId })
    
    // Get shop data
    const shopDoc = await db.collection('shops').doc(shopId).get()
    if (!shopDoc.exists) {
      return NextResponse.json(
        { error: 'Shop not found' },
        { status: 404 }
      )
    }
    
    const shopData = shopDoc.data()
    console.log('Shop data:', shopData)
    
    // Test Shopify API directly
    let shopifyDomain = shopData?.shopifyDomain
    const accessToken = shopData?.shopifyAccessToken
    
    if (!shopifyDomain || !accessToken) {
      return NextResponse.json(
        { 
          error: 'Missing credentials',
          shopData: {
            hasDomain: !!shopifyDomain,
            hasToken: !!accessToken,
            domain: shopifyDomain
          }
        },
        { status: 400 }
      )
    }

    // Convert custom domain to myshopify domain if needed
    // This handles cases where the shop was created with a custom domain instead of the myshopify domain
    if (shopifyDomain === 'cutts-pieces.com') {
      console.log('Converting custom domain to myshopify domain:', shopifyDomain, '-> v4b0fh-da.myshopify.com')
      shopifyDomain = 'v4b0fh-da.myshopify.com'
    }

    // Log the domain being used for API calls
    console.log('Using shop domain:', shopifyDomain)
    
    // First test basic shop connectivity
    console.log('Testing basic shop connectivity...')
    const shopInfoUrl = `https://${shopifyDomain}/admin/api/2023-10/shop.json`
    
    let shopInfoTest = null
    try {
      const shopResponse = await fetch(shopInfoUrl, {
        method: 'GET',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      })
      
      const shopData = await shopResponse.text()
      shopInfoTest = {
        url: shopInfoUrl,
        status: shopResponse.status,
        statusText: shopResponse.statusText,
        response: shopData,
        success: shopResponse.ok
      }
      
      console.log('Shop info test result:', shopInfoTest)
    } catch (error: any) {
      shopInfoTest = {
        url: shopInfoUrl,
        error: error.message,
        success: false
      }
      console.log('Shop info test error:', shopInfoTest)
    }

    // Test the collection_listings API call
    const shopifyUrl = `https://${shopifyDomain}/admin/api/2024-01/collection_listings.json`
    console.log('Testing Shopify API call to:', shopifyUrl)
    
    const response = await fetch(shopifyUrl, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    })
    
    console.log('Shopify API response:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries())
    })
    
    const responseText = await response.text()
    console.log('Response body length:', responseText.length)
    console.log('Response body preview:', responseText.substring(0, 500))
    
    // Try to parse the response if it's JSON
    let parsedResponse = null
    try {
      parsedResponse = JSON.parse(responseText)
      console.log('Parsed response structure:', {
        hasCollections: !!parsedResponse.collections,
        collectionsCount: parsedResponse.collections?.length || 0,
        hasErrors: !!parsedResponse.errors,
        errors: parsedResponse.errors
      })
    } catch (parseError) {
      console.log('Response is not valid JSON:', parseError.message)
    }
    
    return NextResponse.json({
      success: response.ok,
      debug: {
        shopData: {
          domain: shopifyDomain,
          hasToken: !!accessToken,
          tokenLength: accessToken?.length
        },
        shopInfoTest: shopInfoTest,
        collectionsApiCall: {
          url: shopifyUrl,
          status: response.status,
          statusText: response.statusText,
          responseBody: responseText,
          parsedResponse: parsedResponse,
          responseHeaders: Object.fromEntries(response.headers.entries())
        }
      }
    })
    
  } catch (error: any) {
    console.error('Debug collections error:', error)
    return NextResponse.json(
      { 
        error: 'Debug failed',
        message: error.message,
        stack: error.stack
      },
      { status: 500 }
    )
  }
}

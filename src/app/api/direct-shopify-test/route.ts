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
    
    console.log('=== DIRECT SHOPIFY TEST ===')
    console.log('UserId:', userId, 'ShopId:', shopId)
    
    if (!shopId) {
      return NextResponse.json(
        { error: 'Shop ID is required' },
        { status: 400 }
      )
    }

    // Get shop data
    const shopDoc = await db.collection('shops').doc(shopId).get()
    
    if (!shopDoc.exists) {
      return NextResponse.json(
        { error: 'Shop not found' },
        { status: 404 }
      )
    }
    
    const shopData = shopDoc.data()
    console.log('Shop data:', {
      shopId,
      userId: shopData?.userId,
      expectedUserId: userId,
      shopifyDomain: shopData?.shopifyDomain,
      tokenLength: shopData?.shopifyAccessToken?.length
    })
    
    if (shopData?.userId !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized access to shop' },
        { status: 403 }
      )
    }

    const shopifyDomain = shopData.shopifyDomain
    const accessToken = shopData.shopifyAccessToken
    
    if (!shopifyDomain || !accessToken) {
      return NextResponse.json(
        { 
          error: 'Missing credentials',
          debug: {
            hasDomain: !!shopifyDomain,
            hasToken: !!accessToken,
            domain: shopifyDomain
          }
        },
        { status: 400 }
      )
    }

    // Convert domain if needed
    let testDomain = shopifyDomain
    if (shopifyDomain === 'cutts-pieces.com') {
      testDomain = 'v4b0fh-da.myshopify.com'
    }

    console.log('Testing shop domain:', testDomain)

    // Test 1: Try to get basic shop info with current domain
    const shopInfoResponse = await fetch(`https://${testDomain}/admin/api/2023-10/shop.json`, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    })

    console.log('Shop info test result:', {
      url: `https://${testDomain}/admin/api/2023-10/shop.json`,
      status: shopInfoResponse.status,
      statusText: shopInfoResponse.statusText,
      success: shopInfoResponse.ok
    })

    // Test 2: Try alternative domains if current one fails
    const alternativeDomains = [
      'cutts-pieces.com',
      'cutts-pieces.myshopify.com',
      'cuttspieces.myshopify.com',
      'v4b0fh-da.myshopify.com'
    ]

    const domainTestResults = []

    for (const domain of alternativeDomains) {
      if (domain === testDomain) continue // Skip the one we already tested
      
      try {
        console.log(`Testing alternative domain: ${domain}`)
        const response = await fetch(`https://${domain}/admin/api/2023-10/shop.json`, {
          method: 'GET',
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        })

        const result = {
          domain,
          status: response.status,
          statusText: response.statusText,
          success: response.ok
        }

        if (response.ok) {
          try {
            const data = await response.json()
            result.shopData = {
              name: data.shop?.name,
              domain: data.shop?.domain,
              email: data.shop?.email,
              plan: data.shop?.plan_name
            }
          } catch (e) {
            result.error = 'Failed to parse shop data'
          }
        } else {
          const errorText = await response.text()
          result.error = errorText.substring(0, 200)
        }

        domainTestResults.push(result)
        console.log(`Domain ${domain} test:`, result)

      } catch (error: any) {
        domainTestResults.push({
          domain,
          success: false,
          error: error.message
        })
        console.log(`Domain ${domain} failed:`, error.message)
      }
    }

    // Test 3: Test collections endpoint with working domain
    const workingDomain = domainTestResults.find(r => r.success)?.domain || testDomain
    console.log('Testing collections with domain:', workingDomain)

    let collectionsResult = null
    try {
      const collectionsResponse = await fetch(`https://${workingDomain}/admin/api/2024-01/collection_listings.json`, {
        method: 'GET',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      })

      collectionsResult = {
        domain: workingDomain,
        url: `https://${workingDomain}/admin/api/2024-01/collection_listings.json`,
        status: collectionsResponse.status,
        statusText: collectionsResponse.statusText,
        success: collectionsResponse.ok
      }

      if (collectionsResponse.ok) {
        try {
          const data = await collectionsResponse.json()
          collectionsResult.collectionsCount = data.collection_listings?.length || 0
          collectionsResult.collections = data.collection_listings?.slice(0, 3) // First 3 collections for preview
        } catch (e) {
          collectionsResult.error = 'Failed to parse collections data'
        }
      } else {
        const errorText = await collectionsResponse.text()
        collectionsResult.error = errorText.substring(0, 200)
      }

    } catch (error: any) {
      collectionsResult = {
        domain: workingDomain,
        success: false,
        error: error.message
      }
    }

    return NextResponse.json({
      success: true,
      testResults: {
        originalDomain: testDomain,
        originalShopInfoTest: {
          url: `https://${testDomain}/admin/api/2023-10/shop.json`,
          status: shopInfoResponse.status,
          statusText: shopInfoResponse.statusText,
          success: shopInfoResponse.ok
        },
        alternativeDomainTests: domainTestResults,
        collectionsTest: collectionsResult,
        recommendations: [
          workingDomain !== testDomain ? `✅ Use domain: ${workingDomain}` : null,
          collectionsResult?.success ? `✅ Collections endpoint working with ${workingDomain}` : `❌ Collections endpoint failing`,
          accessToken.length < 40 ? '❌ Access token appears too short' : '✅ Access token length looks good'
        ].filter(Boolean)
      }
    })
    
  } catch (error: any) {
    console.error('Direct Shopify test error:', error)
    return NextResponse.json(
      { 
        error: 'Test failed',
        message: error.message
      },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/firebase-admin'
import { db } from '@/lib/firebase-admin'
import { testShopifyConnection } from '@/lib/shopify-test'

async function verifyAuthToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('No authorization token provided')
  }
  
  const token = authHeader.split('Bearer ')[1]
  const decodedToken = await auth.verifyIdToken(token)
  return decodedToken
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shopId: string }> }
) {
  try {
    const decodedToken = await verifyAuthToken(request)
    const userId = decodedToken.uid
    const { shopId } = await params

    // Verify the shop belongs to the user
    const shopDoc = await db.collection('shops').doc(shopId).get()
    if (!shopDoc.exists) {
      return NextResponse.json(
        { error: 'Shop not found' },
        { status: 404 }
      )
    }

    const shopData = shopDoc.data()
    if (shopData?.userId !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized access to shop' },
        { status: 403 }
      )
    }

    // Fetch products from Shopify using the shop's credentials
    const shopifyDomain = shopData.shopifyDomain
    const accessToken = shopData.shopifyAccessToken

    if (!shopifyDomain || !accessToken) {
      return NextResponse.json(
        { error: 'Shop credentials not found' },
        { status: 400 }
      )
    }

    // Make request to Shopify API
    const response = await fetch(`https://${shopifyDomain}/admin/api/2024-01/products.json`, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error('Shopify API error:', errorData)
      return NextResponse.json(
        { error: 'Failed to fetch products from Shopify', details: errorData },
        { status: response.status }
      )
    }

    const data = await response.json()
    const products = data.products || []

    // Determine currency - if not stored, fetch from Shopify
    let currency = shopData.currency
    if (!currency && shopifyDomain && accessToken) {
      try {
        const connectionTest = await testShopifyConnection(shopifyDomain, accessToken)
        if (connectionTest.success && connectionTest.shopInfo?.currency) {
          currency = connectionTest.shopInfo.currency
          // Optionally update the shop document with the currency
          await db.collection('shops').doc(shopId).update({
            currency: currency
          })
        }
      } catch (error) {
        console.log('Failed to fetch currency from Shopify:', error)
      }
    }

    return NextResponse.json({ 
      products,
      shop: {
        id: shopId,
        name: shopData.shopName || shopData.shopifyDomain,
        domain: shopData.shopifyDomain,
        currency: currency || 'USD'
      }
    })

  } catch (error: any) {
    console.error('Error fetching shop products:', error)
    
    if (error.message === 'No authorization token provided') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

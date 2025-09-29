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
    
    console.log('=== FIX SHOP DOMAIN ===')
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
    
    if (shopData?.userId !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized access to shop' },
        { status: 403 }
      )
    }

    const accessToken = shopData.shopifyAccessToken
    if (!accessToken) {
      return NextResponse.json(
        { error: 'No access token found' },
        { status: 400 }
      )
    }

    // Common domain patterns to try
    const domainPatterns = [
      'cutts-pieces.com',
      'cutts-pieces.myshopify.com', 
      'cuttspieces.myshopify.com',
      'v4b0fh-da.myshopify.com',
      'cutts-pieces-dev.myshopify.com'
    ]

    console.log('Testing domain patterns...')
    
    for (const domain of domainPatterns) {
      console.log(`Testing domain: ${domain}`)
      
      try {
        const response = await fetch(`https://${domain}/admin/api/2023-10/shop.json`, {
          method: 'GET',
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        })

        console.log(`Domain ${domain}: ${response.status}`)

        if (response.ok) {
          const shopInfo = await response.json()
          const shopDataFromAPI = shopInfo.shop
          
          console.log(`✅ Found working domain: ${domain}`)
          console.log(`Shop info:`, {
            name: shopDataFromAPI.name,
            domain: shopDataFromAPI.domain,
            email: shopDataFromAPI.email
          })

          // Update the shop in Firestore with the correct domain
          await db.collection('shops').doc(shopId).update({
            shopifyDomain: shopDataFromAPI.domain || domain,
            shopName: shopDataFromAPI.name || shopData.shopName,
            shopEmail: shopDataFromAPI.email || shopData.shopEmail,
            currency: shopDataFromAPI.currency || shopData.currency,
            updatedAt: new Date()
          })

          console.log('✅ Shop updated with correct domain')

          return NextResponse.json({
            success: true,
            message: `Shop domain updated successfully`,
            oldDomain: shopData.shopifyDomain,
            newDomain: shopDataFromAPI.domain || domain,
            shopInfo: {
              name: shopDataFromAPI.name,
              domain: shopDataFromAPI.domain || domain,
              email: shopDataFromAPI.email,
              currency: shopDataFromAPI.currency
            }
          })
        }
      } catch (error: any) {
        console.log(`Domain ${domain} failed:`, error.message)
      }
    }

    return NextResponse.json(
      { 
        error: 'No accessible shop found',
        message: 'Could not find a working domain for your shop. Please check your access token and try reconnecting.',
        testedDomains: domainPatterns
      },
      { status: 404 }
    )
    
  } catch (error: any) {
    console.error('Fix shop domain error:', error)
    return NextResponse.json(
      { 
        error: 'Fix failed',
        message: error.message
      },
      { status: 500 }
    )
  }
}

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shopId: string }> }
) {
  console.log('=== COLLECTIONS API CALLED ===')
  console.log('Request URL:', request.url)
  console.log('Request method:', request.method)
  console.log('Request headers:', Object.fromEntries(request.headers.entries()))
  
  try {
    const decodedToken = await verifyAuthToken(request)
    const userId = decodedToken.uid
    const { shopId } = await params
    
    console.log('Auth successful, userId:', userId, 'shopId:', shopId)

    // Verify the shop belongs to the user
    console.log('Fetching shop document for shopId:', shopId, 'userId:', userId)
    const shopDoc = await db.collection('shops').doc(shopId).get()
    
    if (!shopDoc.exists) {
      console.error('Shop document not found for shopId:', shopId)
      return NextResponse.json(
        { error: 'Shop not found', message: `No shop found with ID: ${shopId}` },
        { status: 404 }
      )
    }

    const shopData = shopDoc.data()
    console.log('Shop data retrieved:', {
      shopId,
      userId: shopData?.userId,
      expectedUserId: userId,
      hasShopifyDomain: !!shopData?.shopifyDomain,
      hasAccessToken: !!shopData?.shopifyAccessToken
    })
    
    if (shopData?.userId !== userId) {
      console.error('User ID mismatch:', { 
        shopUserId: shopData?.userId, 
        requestUserId: userId 
      })
      return NextResponse.json(
        { 
          error: 'Unauthorized access to shop', 
          message: 'You do not have permission to access this shop'
        },
        { status: 403 }
      )
    }

    // Fetch collections from Shopify using the shop's credentials
    let shopifyDomain = shopData.shopifyDomain
    const accessToken = shopData.shopifyAccessToken

    console.log('Shop data:', {
      shopifyDomain,
      hasAccessToken: !!accessToken,
      accessTokenLength: accessToken?.length
    })

    if (!shopifyDomain || !accessToken) {
      return NextResponse.json(
        { error: 'Shop credentials not found', details: { shopifyDomain, hasAccessToken: !!accessToken } },
        { status: 400 }
      )
    }

    // Convert custom domain to myshopify domain if needed
    // This handles cases where the shop was created with a custom domain instead of the myshopify domain
    if (shopifyDomain === 'cutts-pieces.com') {
      console.log('Converting custom domain to myshopify domain:', shopifyDomain, '-> v4b0fh-da.myshopify.com')
      shopifyDomain = 'v4b0fh-da.myshopify.com'
    }

    // Validate shop domain format
    if (!shopifyDomain.includes('.myshopify.com') && !shopifyDomain.includes('.shopify.com')) {
      console.warn('Warning: Domain may not be in correct myshopifies format:', shopifyDomain)
    }

    // Log the domain being used for API calls
    console.log('Using shop domain for API calls:', shopifyDomain)

    // Validate access token format (should be a long string)
    if (accessToken.length < 20) {
      return NextResponse.json(
        { 
          error: 'Invalid access token format',
          details: { 
            tokenLength: accessToken.length,
            expected: 'Access token should be a long string (usually 50+ characters)'
          },
          suggestions: [
            'Access token appears to be too short',
            'Verify you copied the complete token from Shopify admin'
          ]
        },
        { status: 400 }
      )
    }

    // First, let's test basic connectivity with a simple shop endpoint
    console.log('Testing basic Shopify API connectivity...')
    const shopInfoUrl = `https://${shopifyDomain}/admin/api/2024-01/shop.json`
    
    try {
      const shopResponse = await fetch(shopInfoUrl, {
        method: 'GET',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      })
      
      console.log('Shop info API test:', {
        url: shopInfoUrl,
        status: shopResponse.status,
        statusText: shopResponse.statusText,
        headers: Object.fromEntries(shopResponse.headers.entries())
      })
      
      if (shopResponse.ok) {
        const shopData = await shopResponse.json()
        console.log('Shop info retrieved successfully:', {
          shopName: shopData.shop?.name,
          domain: shopData.shop?.domain,
          email: shopData.shop?.email
        })
      } else {
        const errorText = await shopResponse.text()
        console.log('Shop info API failed:', errorText)
      }
    } catch (shopError: any) {
      console.log('Shop info API error:', shopError.message)
    }

    // Use the latest stable API version for collections
    console.log('Testing collections endpoint...')
    const endpoints = [
      `https://${shopifyDomain}/admin/api/2024-01/collections.json`
    ]
    
    let response = null
    let lastError = null
    let allErrors = []
    
    for (const shopifyUrl of endpoints) {
      console.log('Trying Shopify API endpoint:', shopifyUrl)
      
      try {
        response = await fetch(shopifyUrl, {
          method: 'GET',
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        })
        
        console.log('Response status for', shopifyUrl, ':', response.status)
        console.log('Response headers:', Object.fromEntries(response.headers.entries()))
        
        // If we get a successful response, break out of the loop
        if (response.ok) {
          console.log('Successfully connected to:', shopifyUrl)
          break
        }
        
        // Get error details
        const errorText = await response.text()
        const errorDetails = {
          url: shopifyUrl,
          status: response.status,
          statusText: response.statusText,
          error: errorText,
          headers: Object.fromEntries(response.headers.entries()),
          type: 'http_error'
        }
        
        allErrors.push(errorDetails)
        lastError = errorDetails
        
        console.log('Error with endpoint', shopifyUrl, ':', errorDetails)
        
        // If we get a 404, try the next endpoint
        if (response.status === 404) {
          console.log('Endpoint not found (404), trying next...')
          continue
        }
        
        // For authentication errors, don't try other endpoints
        if (response.status === 401 || response.status === 403) {
          console.log('Authentication error, stopping endpoint attempts')
          console.log('Error details:', errorDetails)
          break
        }
        
        // For API version conflicts, try the next endpoint
        if (response.status === 422 || response.status === 406) {
          console.log('API version incompatible, trying next...')
          continue
        }
        
      } catch (fetchError: any) {
        const errorDetails = {
          url: shopifyUrl,
          error: fetchError.message,
          type: 'fetch_error'
        }
        allErrors.push(errorDetails)
        lastError = errorDetails
        console.log('Fetch error with endpoint', shopifyUrl, ':', fetchError.message)
      }
    }
    
    // If no response was successful, return detailed error information
    if (!response || !response.ok) {
      console.error('All Shopify API endpoints failed. All errors:', allErrors)
      
      // Determine the most likely cause based on error patterns
      let errorMessage = 'Failed to connect to any Shopify API endpoint'
      let suggestions = []
      
      if (allErrors.length > 0) {
        const firstError = allErrors[0]
        
        if (firstError.type === 'fetch_error') {
          errorMessage = 'Network connection failed'
          suggestions.push('Check your internet connection')
          suggestions.push('Verify the shop domain format is correct')
        } else if ('status' in firstError) {
          if (firstError.status === 401) {
            errorMessage = 'Authentication failed - Invalid access token'
            suggestions.push('Check if your Shopify access token is correct and has not expired')
            suggestions.push('Verify the token has read permissions for collections')
          } else if (firstError.status === 403) {
            errorMessage = 'Access forbidden - Insufficient permissions'
            suggestions.push('Ensure your access token has permission to read collections')
            suggestions.push('Check if your app has the required scopes enabled')
          } else if (firstError.status === 404) {
            errorMessage = 'API endpoint not found'
            suggestions.push('Verify your shop domain is correct (should be your-shop.myshopify.com)')
            suggestions.push('Check if your shop is still active')
          }
        }
      }
      
      return NextResponse.json(
        { 
          error: errorMessage,
          details: {
            lastError,
            allErrors,
            shopDomain: shopifyDomain,
            hasAccessToken: !!accessToken,
            tokenLength: accessToken?.length
          },
          suggestions,
          message: 'Please check your shop domain and access token'
        },
        { status: 502 }
      )
    }

    console.log('Shopify API response status:', response.status)
    console.log('Shopify API response headers:', Object.fromEntries(response.headers.entries()))

    const data = await response.json()
    const collections = data.collections || []
    
    console.log('Collections response data:', {
      hasCollections: !!data.collections,
      collectionsCount: collections.length,
      dataKeys: Object.keys(data)
    })

    return NextResponse.json({ 
      collections,
      shop: {
        id: shopId,
        name: shopData.shopName || shopData.shopifyDomain,
        domain: shopData.shopifyDomain
      }
    })

  } catch (error: any) {
    console.error('Error fetching shop collections:', error)
    
    if (error.message === 'No authorization token provided') {
      return NextResponse.json(
        { error: 'Authentication required', message: 'No authorization token provided' },
        { status: 401 }
      )
    }
    
    // Handle Firebase/Firestore errors
    if (error.code === 'permission-denied') {
      return NextResponse.json(
        { 
          error: 'Firestore permission denied', 
          message: 'Firestore security rules not deployed. Please deploy security rules in Firebase Console.',
          details: 'Go to Firebase Console → Firestore Database → Rules and deploy the security rules.'
        },
        { status: 403 }
      )
    }
    
    // Handle network/API errors
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return NextResponse.json(
        { 
          error: 'Network error', 
          message: 'Unable to connect to Shopify API',
          details: error.message
        },
        { status: 502 }
      )
    }
    
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        message: 'An unexpected error occurred while fetching collections',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    )
  }
}

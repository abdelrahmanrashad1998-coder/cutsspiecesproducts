import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/firebase-admin'
import { db } from '@/lib/firebase-admin'

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
  
  if (!auth) {
    throw new Error('Firebase Admin SDK not initialized')
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
    
    if (!db) {
      const response = NextResponse.json(
        { error: 'Database not initialized', message: 'Firebase Admin SDK not properly configured' },
        { status: 500 }
      )
      return addCorsHeaders(response)
    }
    
    const shopDoc = await db.collection('shops').doc(shopId).get()
    
    if (!shopDoc.exists) {
      const response = NextResponse.json(
        { error: 'Shop not found', message: `No shop found with ID: ${shopId}` },
        { status: 404 }
      )
      return addCorsHeaders(response)
    }

    const shopData = shopDoc.data()
    
    if (shopData?.userId !== userId) {
      const response = NextResponse.json(
        { 
          error: 'Unauthorized access to shop', 
          message: 'You do not have permission to access this shop'
        },
        { status: 403 }
      )
      return addCorsHeaders(response)
    }

    // Fetch collections from Shopify using the shop's credentials
    let shopifyDomain = shopData.shopifyDomain
    const accessToken = shopData.shopifyAccessToken


    if (!shopifyDomain || !accessToken) {
      const response = NextResponse.json(
        { error: 'Shop credentials not found', details: { shopifyDomain, hasAccessToken: !!accessToken } },
        { status: 400 }
      )
      return addCorsHeaders(response)
    }

    // Convert custom domain to myshopify domain if needed
    // This handles cases where the shop was created with a custom domain instead of the myshopify domain
    if (shopifyDomain === 'cutts-pieces.com') {
      shopifyDomain = 'v4b0fh-da.myshopify.com'
    }

    // Validate shop domain format
    if (!shopifyDomain.includes('.myshopify.com') && !shopifyDomain.includes('.shopify.com')) {
    }

    // Log the domain being used for API calls

    // Validate access token format (should be a long string)
    if (accessToken.length < 20) {
      const response = NextResponse.json(
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
      return addCorsHeaders(response)
    }

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
      
      
      if (shopResponse.ok) {
        const shopData = await shopResponse.json()
      } else {
        const errorText = await shopResponse.text()
      }
    } catch (shopError: any) {
    }

    // Use GraphQL to fetch collections (more reliable than REST collection_listings)
    const graphqlUrl = `https://${shopifyDomain}/admin/api/2023-10/graphql.json`
    
    const graphqlQuery = {
      query: `
        query {
          collections(first: 50) {
            edges {
              node {
                id
                title
                handle
                updatedAt
                description
                image {
                  url
                  altText
                }
              }
            }
          }
        }
      `
    }
    
    try {
      const graphqlResponse = await fetch(graphqlUrl, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(graphqlQuery)
      })
      
      
      if (!graphqlResponse.ok) {
        const errorText = await graphqlResponse.text()
        
        let errorMessage = 'Failed to fetch collections via GraphQL'
        let suggestions = []
        
        if (graphqlResponse.status === 401) {
          errorMessage = 'Authentication failed - Invalid access token'
          suggestions.push('Check if your Shopify access token is correct and has not expired')
          suggestions.push('Verify the token has read permissions for collections')
        } else if (graphqlResponse.status === 403) {
          errorMessage = 'Access forbidden - Insufficient permissions'
          suggestions.push('Ensure your access token has permission to read collections')
          suggestions.push('Check if your app has the required scopes enabled (read_products)')
        } else if (graphqlResponse.status === 404) {
          errorMessage = 'GraphQL endpoint not found'
          suggestions.push('Verify your shop domain is correct (should be your-shop.myshopify.com)')
          suggestions.push('Check if your shop is still active')
        }
        
        const errorResponse = NextResponse.json(
          { 
            error: errorMessage,
            details: {
              status: graphqlResponse.status,
              statusText: graphqlResponse.statusText,
              error: errorText,
              shopDomain: shopifyDomain,
              hasAccessToken: !!accessToken,
              tokenLength: accessToken?.length
            },
            suggestions,
            message: 'Please check your shop domain and access token'
          },
          { status: 502 }
        )
        return addCorsHeaders(errorResponse)
      }
      
      const data = await graphqlResponse.json()
      
      // Transform GraphQL response to match expected frontend format
      const collections = data.data?.collections?.edges?.map((edge: any) => ({
        id: parseInt(edge.node.id.split('/').pop()) || 0, // Extract numeric ID from GraphQL ID
        title: edge.node.title,
        body_html: edge.node.description || '',
        handle: edge.node.handle,
        published_at: null, // GraphQL doesn't provide this field
        sort_order: 'manual', // Default value
        template_suffix: null,
        disjunctive: false, // Default value
        rules: [], // Empty array since GraphQL doesn't provide rules
        published_scope: 'web', // Default value
        admin_graphql_api_id: edge.node.id,
        image: edge.node.image ? {
          id: 0,
          src: edge.node.image.url,
          alt: edge.node.image.altText
        } : undefined,
        updated_at: edge.node.updatedAt,
        created_at: edge.node.updatedAt // Use updatedAt as fallback
      })) || []
      

      const response = NextResponse.json({ 
        collections,
        shop: {
          id: shopId,
          name: shopData.shopName || shopData.shopifyDomain,
          domain: shopData.shopifyDomain
        }
      })
      return addCorsHeaders(response)
      
    } catch (graphqlError: any) {
      
      const response = NextResponse.json(
        { 
          error: 'GraphQL request failed',
          message: 'Failed to fetch collections via GraphQL',
          details: graphqlError.message,
          shopDomain: shopifyDomain,
          hasAccessToken: !!accessToken
        },
        { status: 502 }
      )
      return addCorsHeaders(response)
    }

  } catch (error: any) {
    
    if (error.message === 'No authorization token provided') {
      const response = NextResponse.json(
        { error: 'Authentication required', message: 'No authorization token provided' },
        { status: 401 }
      )
      return addCorsHeaders(response)
    }
    
    // Handle Firebase/Firestore errors
    if (error.code === 'permission-denied') {
      const response = NextResponse.json(
        { 
          error: 'Firestore permission denied', 
          message: 'Firestore security rules not deployed. Please deploy security rules in Firebase Console.',
          details: 'Go to Firebase Console → Firestore Database → Rules and deploy the security rules.'
        },
        { status: 403 }
      )
      return addCorsHeaders(response)
    }
    
    // Handle network/API errors
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      const response = NextResponse.json(
        { 
          error: 'Network error', 
          message: 'Unable to connect to Shopify API',
          details: error.message
        },
        { status: 502 }
      )
      return addCorsHeaders(response)
    }
    
    const response = NextResponse.json(
      { 
        error: 'Internal server error', 
        message: 'An unexpected error occurred while fetching collections',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    )
    return addCorsHeaders(response)
  }
}

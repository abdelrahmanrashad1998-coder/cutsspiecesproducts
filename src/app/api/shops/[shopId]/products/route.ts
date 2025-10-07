import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/firebase-admin'
import { db } from '@/lib/firebase-admin'
import { testShopifyConnection } from '@/lib/shopify-test'
import { createProductAdmin } from '@/lib/firestore-admin'

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
    let products = data.products || []

    // Try to get collections data using a simple GraphQL query
    try {
      const graphqlUrl = `https://${shopifyDomain}/admin/api/2023-10/graphql.json`
      const graphqlQuery = {
        query: `
          query getProductCollections {
            products(first: 50) {
              edges {
                node {
                  id
                  collections(first: 10) {
                    edges {
                      node {
                        id
                        title
                        handle
                      }
                    }
                  }
                }
              }
            }
          }
        `
      }
      
      const graphqlResponse = await fetch(graphqlUrl, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(graphqlQuery)
      })

      if (graphqlResponse.ok) {
        const graphqlData = await graphqlResponse.json()
        
        if (graphqlData.data?.products?.edges) {
          // Create a map of product ID to collections
          const productCollectionsMap: { [productId: string]: any[] } = {}
          
          graphqlData.data.products.edges.forEach((edge: any) => {
            const productId = parseInt(edge.node.id.split('/').pop()) || 0
            const collections = edge.node.collections.edges.map((cEdge: any) => ({
              id: parseInt(cEdge.node.id.split('/').pop()) || 0,
              title: cEdge.node.title,
              handle: cEdge.node.handle
            }))
            
            if (collections.length > 0) {
              productCollectionsMap[productId] = collections
            }
          })

          // Add collections data to products
          products = products.map((product: any) => ({
            ...product,
            collections: productCollectionsMap[product.id] || []
          }))
        }
      }
    } catch (error) {
      console.warn('Failed to fetch collections via GraphQL, continuing without collections:', error)
      // Add empty collections array to products
      products = products.map((product: any) => ({
        ...product,
        collections: []
      }))
    }

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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ shopId: string }> }
) {
  try {
    const decodedToken = await verifyAuthToken(request)
    const userId = decodedToken.uid
    const { shopId } = await params
    const productData = await request.json()

    // Validate required fields
    if (!productData.title || !productData.body_html) {
      return NextResponse.json(
        { error: 'Title and description are required' },
        { status: 400 }
      )
    }

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

    // Get shop credentials
    const shopifyDomain = shopData.shopifyDomain
    const accessToken = shopData.shopifyAccessToken

    if (!shopifyDomain || !accessToken) {
      return NextResponse.json(
        { error: 'Shop credentials not found' },
        { status: 400 }
      )
    }

    // Create product in Shopify using shop-specific credentials
    const shopifyUrl = `https://${shopifyDomain}/admin/api/2024-01/products.json`
    const shopifyResponse = await fetch(shopifyUrl, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        product: productData
      }),
    })

    if (!shopifyResponse.ok) {
      const errorData = await shopifyResponse.text()
      console.error('Shopify create product error:', errorData)
      return NextResponse.json(
        { error: 'Failed to create product in Shopify', details: errorData },
        { status: shopifyResponse.status }
      )
    }

    const shopifyProduct = await shopifyResponse.json()
    
    // Save product to Firestore for local tracking
    const firestoreProduct = await createProductAdmin({
      shopifyId: shopifyProduct.product.id.toString(),
      title: shopifyProduct.product.title,
      description: shopifyProduct.product.body_html,
      vendor: shopifyProduct.product.vendor,
      category: shopifyProduct.product.product_type,
      images: shopifyProduct.product.images || [],
      variants: shopifyProduct.product.variants || [],
      userId: userId,
      isActive: true
    })

    return NextResponse.json({ 
      success: true,
      product: {
        id: shopifyProduct.product.id,
        ...shopifyProduct.product,
        firestoreId: firestoreProduct.id
      }
    })
  } catch (error) {
    console.error('Error creating product:', error)
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('No valid authorization token')) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        )
      }
      if (error.message.includes('Shopify')) {
        return NextResponse.json(
          { error: 'Failed to create product in Shopify' },
          { status: 500 }
        )
      }
      if (error.message.includes('Firebase') || error.message.includes('Firestore')) {
        return NextResponse.json(
          { error: 'Database connection error' },
          { status: 500 }
        )
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 }
    )
  }
}

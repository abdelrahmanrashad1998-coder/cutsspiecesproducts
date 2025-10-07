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
  
  const token = authHeader.split('Bearer ')[1]
  const decodedToken = await auth.verifyIdToken(token)
  return decodedToken
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ shopId: string; productId: string }> }
) {
  try {
    console.log('=== PRODUCT UPDATE API CALLED ===')
    
    const decodedToken = await verifyAuthToken(request)
    const userId = decodedToken.uid
    const { shopId, productId } = await params

    console.log('Product update request:', { shopId, productId, userId })

    // Verify the shop belongs to the user
    const shopDoc = await db.collection('shops').doc(shopId).get()
    
    if (!shopDoc.exists) {
      const response = NextResponse.json(
        { error: 'Shop not found' },
        { status: 404 }
      )
      return addCorsHeaders(response)
    }

    const shopData = shopDoc.data()
    if (shopData?.userId !== userId) {
      const response = NextResponse.json(
        { error: 'Unauthorized access to shop' },
        { status: 403 }
      )
      return addCorsHeaders(response)
    }

    // Get the product update data
    const updateData = await request.json()
    console.log('Product update data:', updateData)

    // Get shop credentials
    const shopifyDomain = shopData.shopifyDomain
    const accessToken = shopData.shopifyAccessToken

    if (!shopifyDomain || !accessToken) {
      const response = NextResponse.json(
        { error: 'Shop credentials not found' },
        { status: 400 }
      )
      return addCorsHeaders(response)
    }

    // Prepare the product data for Shopify API
    const shopifyProductData = {
      product: {
        id: parseInt(productId),
        title: updateData.title,
        body_html: updateData.body_html,
        vendor: updateData.vendor,
        product_type: updateData.product_type,
        variants: updateData.variants?.map((variant: any) => ({
          id: variant.id ? parseInt(variant.id) : undefined,
          price: variant.price,
          option1: variant.option1,
          option2: variant.option2,
          option3: variant.option3,
          inventory_management: variant.inventory_management,
        })) || [],
        images: updateData.images?.map((img: any) => ({
          src: img.src,
          alt: img.alt || updateData.title
        })) || []
      }
    }

    console.log('Sending to Shopify:', JSON.stringify(shopifyProductData, null, 2))

    // Update product in Shopify
    const shopifyUrl = `https://${shopifyDomain}/admin/api/2024-01/products/${productId}.json`
    const shopifyResponse = await fetch(shopifyUrl, {
      method: 'PUT',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(shopifyProductData),
    })

    console.log('Shopify update response status:', shopifyResponse.status)
    console.log('Shopify response headers:', Object.fromEntries(shopifyResponse.headers.entries()))

    if (!shopifyResponse.ok) {
      const errorData = await shopifyResponse.text()
      console.error('Shopify update error details:', {
        status: shopifyResponse.status,
        statusText: shopifyResponse.statusText,
        errorData,
        url: shopifyUrl,
        requestData: shopifyProductData
      })
      
      let errorMessage = 'Failed to update product in Shopify'
      let errorDetails = errorData
      
      // Handle specific Shopify error codes
      if (response.status === 422) {
        errorMessage = 'Product validation failed'
        try {
          const parsedError = JSON.parse(errorData)
          errorDetails = {
            message: 'Shopify validation error',
            errors: parsedError.errors || parsedError,
            requestData: shopifyProductData
          }
        } catch (e) {
          errorDetails = {
            message: 'Shopify validation error',
            rawError: errorData,
            requestData: shopifyProductData
          }
        }
      }
      
      const errorResponse = NextResponse.json(
        { error: errorMessage, details: errorDetails },
        { status: shopifyResponse.status }
      )
      return addCorsHeaders(errorResponse)
    }

    const updatedProduct = await shopifyResponse.json()
    console.log('Product updated successfully:', updatedProduct)

    const response = NextResponse.json({ 
      success: true,
      product: updatedProduct.product,
      message: 'Product updated successfully'
    })
    return addCorsHeaders(response)

  } catch (error: any) {
    console.error('Error updating product:', error)
    
    if (error.message === 'No authorization token provided') {
      const response = NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
      return addCorsHeaders(response)
    }
    
    const response = NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'An unexpected error occurred while updating the product',
        details: error.message
      },
      { status: 500 }
    )
    return addCorsHeaders(response)
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shopId: string; productId: string }> }
) {
  try {
    const decodedToken = await verifyAuthToken(request)
    const userId = decodedToken.uid
    const { shopId, productId } = await params

    // Verify the shop belongs to the user
    const shopDoc = await db.collection('shops').doc(shopId).get()
    
    if (!shopDoc.exists) {
      const response = NextResponse.json(
        { error: 'Shop not found' },
        { status: 404 }
      )
      return addCorsHeaders(response)
    }

    const shopData = shopDoc.data()
    if (shopData?.userId !== userId) {
      const response = NextResponse.json(
        { error: 'Unauthorized access to shop' },
        { status: 403 }
      )
      return addCorsHeaders(response)
    }

    // Get shop credentials
    const shopifyDomain = shopData.shopifyDomain
    const accessToken = shopData.shopifyAccessToken

    if (!shopifyDomain || !accessToken) {
      const response = NextResponse.json(
        { error: 'Shop credentials not found' },
        { status: 400 }
      )
      return addCorsHeaders(response)
    }

    // First try the REST API to get the product, then use GraphQL for collections if needed
    const shopifyUrl = `https://${shopifyDomain}/admin/api/2024-01/products/${productId}.json`
    const shopifyResponse = await fetch(shopifyUrl, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    })

    if (!shopifyResponse.ok) {
      const errorData = await shopifyResponse.text()
      console.error('Shopify get product error:', errorData)
      const errorResponse = NextResponse.json(
        { error: 'Failed to fetch product from Shopify', details: errorData },
        { status: shopifyResponse.status }
      )
      return addCorsHeaders(errorResponse)
    }

    const productData = await shopifyResponse.json()
    const product = productData.product

    // Now get collections using GraphQL
    const graphqlUrl = `https://${shopifyDomain}/admin/api/2023-10/graphql.json`
    
    const graphqlQuery = {
      query: `
        query getProductCollections($id: ID!) {
          product(id: $id) {
            id
            collections(first: 50) {
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
      `,
      variables: {
        id: `gid://shopify/Product/${productId}`
      }
    }
    
    let collections: any[] = []
    
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

      if (graphqlResponse.ok) {
        const graphqlData = await graphqlResponse.json()
        
        if (graphqlData.data?.product?.collections) {
          collections = graphqlData.data.product.collections.edges.map((edge: any) => ({
            id: parseInt(edge.node.id.split('/').pop()) || 0,
            title: edge.node.title,
            handle: edge.node.handle
          }))
        }
      } else {
        console.warn('Failed to fetch collections via GraphQL, continuing without collections')
      }
    } catch (graphqlError) {
      console.warn('GraphQL error for collections, continuing without collections:', graphqlError)
    }

    // Transform the product data to include collections
    const transformedProduct = {
      ...product,
      collections: collections
    }

    const response = NextResponse.json({ 
      product: transformedProduct
    })
    return addCorsHeaders(response)

  } catch (error: any) {
    console.error('Error fetching product:', error)
    
    if (error.message === 'No authorization token provided') {
      const response = NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
      return addCorsHeaders(response)
    }
    
    const response = NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
    return addCorsHeaders(response)
  }
}

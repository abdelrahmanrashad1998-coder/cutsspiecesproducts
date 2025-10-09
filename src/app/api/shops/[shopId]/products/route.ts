import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/firebase-admin'
import { db } from '@/lib/firebase-admin'
import { testShopifyConnection } from '@/lib/shopify-test'
import { createProductAdmin } from '@/lib/firestore-admin'

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
  if (!auth) {
    throw new Error('Firebase Admin SDK not initialized')
  }
  const decodedToken = await auth.verifyIdToken(token)
  return decodedToken
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shopId: string }> }
) {
  console.log('=== PRODUCT GET ENDPOINT CALLED ===')
  console.log('Request URL:', request.url)
  
  try {
    const decodedToken = await verifyAuthToken(request)
    const userId = decodedToken.uid
    const { shopId } = await params

    console.log('GET request processed:', { shopId, userId })

    // Check if database is initialized
    if (!db) {
      const errorResponse = NextResponse.json(
        { error: 'Database not initialized', message: 'Firebase Admin SDK not properly configured' },
        { status: 500 }
      )
      return addCorsHeaders(errorResponse)
    }

    // Verify the shop belongs to the user
    // Try to find the shop by Firebase document ID first, then by Shopify domain
    let shopDoc = await db.collection('shops').doc(shopId).get()
    
    if (!shopDoc.exists) {
      // If not found by document ID, try to find by Shopify domain
      console.log(`Shop ${shopId} not found by document ID. Trying to find by Shopify domain...`)
      const domainQuery = await db.collection('shops').where('shopifyDomain', '==', shopId).where('userId', '==', userId).get()
      
      if (domainQuery.docs.length > 0) {
        // Found by domain, use the first match
        shopDoc = domainQuery.docs[0]
        console.log('Found shop by domain:', shopDoc.id)
      } else {
        // Debug: Let's see what shops actually exist for this user
        console.log(`Shop ${shopId} not found by ID or domain. Checking all shops for user ${userId}...`)
        const userShopsQuery = await db.collection('shops').where('userId', '==', userId).get()
        const userShops = userShopsQuery.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        console.log('Available shops for user:', userShops)
        
        const errorResponse = NextResponse.json(
          { 
            error: 'Shop not found',
            debug: {
              requestedShopId: shopId,
              userId: userId,
              availableShops: userShops.map((shop: any) => ({ id: shop.id, shopName: shop.shopName, shopifyDomain: shop.shopifyDomain })),
              searchMethod: 'tried both document ID and domain lookup'
            }
          },
          { status: 404 }
        )
        return addCorsHeaders(errorResponse)
      }
    }

    const shopData = shopDoc.data()
    if (shopData?.userId !== userId) {
      const errorResponse = NextResponse.json(
        { error: 'Unauthorized access to shop' },
        { status: 403 }
      )
      return addCorsHeaders(errorResponse)
    }

    // Fetch products from Shopify using the shop's credentials
    let shopifyDomain = shopData.shopifyDomain
    const accessToken = shopData.shopifyAccessToken

    if (!shopifyDomain || !accessToken) {
      const errorResponse = NextResponse.json(
        { error: 'Shop credentials not found' },
        { status: 400 }
      )
      return addCorsHeaders(errorResponse)
    }

    // Convert custom domain to myshopify domain if needed
    // This ensures we use the development link (.myshopify.com) for API calls
    if (shopifyDomain === 'cutts-pieces.com') {
      shopifyDomain = 'v4b0fh-da.myshopify.com'
    }

    // Make request to Shopify API
    const shopifyResponse = await fetch(`https://${shopifyDomain}/admin/api/2025-10/products.json`, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    })

    if (!shopifyResponse.ok) {
      const errorData = await shopifyResponse.text()
      console.error('Shopify API error:', errorData)
      return NextResponse.json(
        { error: 'Failed to fetch products from Shopify', details: errorData },
        { status: shopifyResponse.status }
      )
    }

    const data = await shopifyResponse.json()
    let products = data.products || []

    // Use GraphQL to get products with collections data
    try {
      const graphqlUrl = `https://${shopifyDomain}/admin/api/2025-10/graphql.json`
      const graphqlQuery = {
        query: `
          query getProducts($first: Int!) {
            products(first: $first) {
              edges {
                node {
                  id
                  title
                  handle
                  status
                  descriptionHtml
                  vendor
                  productType
                  tags
                  createdAt
                  updatedAt
                  images(first: 5) {
                    nodes {
                      id
                      url
                      altText
                    }
                  }
                  variants(first: 10) {
                    nodes {
                      id
                      title
                      price
                      sku
                      inventoryQuantity
                      selectedOptions {
                        name
                        value
                      }
                    }
                  }
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
                cursor
              }
              pageInfo {
                hasNextPage
                hasPreviousPage
                startCursor
                endCursor
              }
            }
          }
        `,
        variables: {
          first: 50
        }
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
          // Transform GraphQL response to match REST API format
          products = graphqlData.data.products.edges.map((edge: any) => {
            const product = edge.node
            return {
              id: parseInt(product.id.split('/').pop()) || 0,
              title: product.title,
              handle: product.handle,
              body_html: product.descriptionHtml,
              vendor: product.vendor,
              product_type: product.productType,
              tags: product.tags.join(', '),
              status: product.status.toLowerCase(),
              created_at: product.createdAt,
              updated_at: product.updatedAt,
              images: product.images.nodes.map((img: any) => ({
                id: parseInt(img.id.split('/').pop()) || 0,
                src: img.url,
                alt: img.altText
              })),
              variants: product.variants.nodes.map((variant: any) => ({
                id: parseInt(variant.id.split('/').pop()) || 0,
                title: variant.title,
                price: variant.price,
                sku: variant.sku,
                inventory_quantity: variant.inventoryQuantity,
                option1: variant.selectedOptions[0]?.value || 'Default',
                option2: variant.selectedOptions[1]?.value || null,
                option3: variant.selectedOptions[2]?.value || null
              })),
              collections: product.collections.edges.map((cEdge: any) => ({
                id: parseInt(cEdge.node.id.split('/').pop()) || 0,
                title: cEdge.node.title,
                handle: cEdge.node.handle
              }))
            }
          })
        }
      } else {
        console.warn('GraphQL request failed, falling back to REST API')
      }
    } catch (error) {
      console.warn('Failed to fetch products via GraphQL, using REST API data:', error)
      // Add empty collections array to products from REST API
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

    const response = NextResponse.json({ 
      products,
      shop: {
        id: shopId,
        name: shopData.shopName || shopData.shopifyDomain,
        domain: shopData.shopifyDomain,
        currency: currency || 'USD'
      }
    })
    return addCorsHeaders(response)

  } catch (error: any) {
    console.error('Error fetching shop products:', error)
    
    if (error.message === 'No authorization token provided') {
      const errorResponse = NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
      return addCorsHeaders(errorResponse)
    }
    
    // Handle Firebase initialization errors
    if (error.message === 'Firebase Admin SDK not initialized') {
      return NextResponse.json(
        { 
          error: 'Firebase not configured', 
          message: 'Firebase Admin SDK is not properly initialized. Please check your environment variables.',
          details: 'Check FIREBASE_ADMIN_PRIVATE_KEY and other Firebase configuration variables.'
        },
        { status: 500 }
      )
    }
    
      const errorResponse = NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
      return addCorsHeaders(errorResponse)
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ shopId: string }> }
) {
  console.log('=== PRODUCT CREATION ENDPOINT CALLED ===')
  console.log('Request URL:', request.url)
  console.log('Request method:', request.method)
  
  try {
    console.log('Step 1: Verifying auth token...')
    const decodedToken = await verifyAuthToken(request)
    const userId = decodedToken.uid
    console.log('Step 2: Getting params...')
    const { shopId } = await params
    console.log('Step 3: Parsing request JSON...')
    const productData = await request.json()
    
    console.log('Request processed successfully:', { shopId, userId, productTitle: productData.title })
    
    // Debug: Log Firebase Admin SDK status
    console.log('Firebase Admin SDK status:', {
      auth: auth ? 'initialized' : 'not initialized',
      db: db ? 'initialized' : 'not initialized'
    })

    // Validate required fields
    console.log('Step 4: Validating required fields...')
    console.log('Product data received:', {
      title: productData.title,
      hasDescriptionHtml: !!productData.descriptionHtml,
      hasBodyHtml: !!productData.body_html, // Support legacy format
      vendor: productData.vendor,
      tags: productData.tags,
      productOptions: productData.productOptions,
      variantsCount: productData.variants?.length || 0,
      imagesCount: productData.images?.length || 0,
      variants: productData.variants
    })
    
    // Support both new descriptionHtml and legacy body_html
    const description = productData.descriptionHtml || productData.body_html
    
    if (!productData.title || !description) {
      console.log('Validation failed: missing title or description')
      const response = NextResponse.json(
        { 
          error: 'Title and description are required',
          received: {
            title: productData.title,
            descriptionHtml: productData.descriptionHtml ? 'present' : 'missing',
            body_html: productData.body_html ? 'present' : 'missing'
          }
        },
        { status: 400 }
      )
      return addCorsHeaders(response)
    }

    // Verify the shop belongs to the user
    console.log('Step 5: Checking database connection...')
    if (!db) {
      console.log('Database not initialized - returning 400 for better debugging')
      const response = NextResponse.json(
        { 
          error: 'Database not initialized',
          message: 'Firebase Admin SDK database connection is not available',
          debug: {
            auth: auth ? 'initialized' : 'not initialized',
            db: db ? 'initialized' : 'not initialized'
          }
        },
        { status: 400 }
      )
      return addCorsHeaders(response)
    }
    console.log('Step 6: Fetching shop document...')
    // Try to find the shop by Firebase document ID first, then by Shopify domain
    let shopDoc = await db.collection('shops').doc(shopId).get()
    
    console.log('Step 7: Checking if shop exists...')
    if (!shopDoc.exists) {
      console.log('Shop not found by document ID:', shopId)
      
      // If not found by document ID, try to find by Shopify domain
      console.log(`Shop ${shopId} not found by document ID. Trying to find by Shopify domain...`)
      const domainQuery = await db.collection('shops').where('shopifyDomain', '==', shopId).where('userId', '==', userId).get()
      
      if (domainQuery.docs.length > 0) {
        // Found by domain, use the first match
        shopDoc = domainQuery.docs[0]
        console.log('Found shop by domain:', shopDoc.id)
      } else {
        console.log('Shop not found by ID or domain:', shopId)
        
        // Debug: Let's see what shops actually exist for this user
        console.log(`Shop ${shopId} not found by ID or domain. Checking all shops for user ${userId}...`)
      try {
        const userShopsQuery = await db.collection('shops').where('userId', '==', userId).get()
        const userShops = userShopsQuery.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        console.log('Available shops for user:', userShops)
        
        const response = NextResponse.json(
          { 
            error: 'Shop not found',
            message: `Shop with ID "${shopId}" does not exist or you don't have access to it.`,
            debug: {
              requestedShopId: shopId,
              userId: userId,
              availableShops: userShops.map((shop: any) => ({ id: shop.id, shopName: shop.shopName, shopifyDomain: shop.shopifyDomain }))
            }
          },
          { status: 404 }
        )
        return addCorsHeaders(response)
      } catch (queryError) {
        console.error('Error querying shops:', queryError)
        const response = NextResponse.json(
          { 
            error: 'Shop not found',
            message: `Shop with ID "${shopId}" does not exist.`,
            debug: {
              requestedShopId: shopId,
              userId: userId,
              queryError: queryError instanceof Error ? queryError.message : 'Unknown error'
            }
          },
          { status: 404 }
        )
        return addCorsHeaders(response)
      }
      }
    }

    console.log('Step 8: Verifying shop ownership...')
    const shopData = shopDoc.data()
    console.log('Shop ownership check:', {
      shopUserId: shopData?.userId,
      currentUserId: userId,
      shopId: shopId,
      shopName: shopData?.shopName,
      shopifyDomain: shopData?.shopifyDomain
    })
    
    if (shopData?.userId !== userId) {
      console.log('Unauthorized access - userId mismatch')
      
      // Get all shops for this user to help with debugging
      try {
        const userShopsQuery = await db.collection('shops').where('userId', '==', userId).get()
        const userShops = userShopsQuery.docs.map(doc => ({ 
          id: doc.id, 
          shopName: doc.data().shopName,
          shopifyDomain: doc.data().shopifyDomain,
          userId: doc.data().userId
        }))
        
        const response = NextResponse.json(
          { 
            error: 'Unauthorized access to shop',
            message: `You don't have access to shop "${shopId}". This shop belongs to user "${shopData?.userId}" but you are user "${userId}".`,
            debug: {
              requestedShopId: shopId,
              currentUserId: userId,
              shopOwnerUserId: shopData?.userId,
              yourShops: userShops
            }
          },
          { status: 403 }
        )
        return addCorsHeaders(response)
      } catch (queryError) {
        const response = NextResponse.json(
          { 
            error: 'Unauthorized access to shop',
            message: `You don't have access to shop "${shopId}". This shop belongs to user "${shopData?.userId}" but you are user "${userId}".`,
            debug: {
              requestedShopId: shopId,
              currentUserId: userId,
              shopOwnerUserId: shopData?.userId,
              queryError: queryError instanceof Error ? queryError.message : 'Unknown error'
            }
          },
          { status: 403 }
        )
        return addCorsHeaders(response)
      }
    }

    // Get shop credentials
    console.log('Step 9: Getting shop credentials...')
    let shopifyDomain = shopData.shopifyDomain
    const accessToken = shopData.shopifyAccessToken

    if (!shopifyDomain || !accessToken) {
      console.log('Missing shop credentials:', { hasDomain: !!shopifyDomain, hasToken: !!accessToken })
      const response = NextResponse.json(
        { error: 'Shop credentials not found' },
        { status: 400 }
      )
      return addCorsHeaders(response)
    }

    // Convert custom domain to myshopify domain if needed
    // This ensures we use the development link (.myshopify.com) for API calls
    if (shopifyDomain === 'cutts-pieces.com') {
      shopifyDomain = 'v4b0fh-da.myshopify.com'
    }
    console.log('Using Shopify domain for API calls:', shopifyDomain)

    // Clean up the product data for Shopify API - replace null values with defaults
    console.log('Step 10: Cleaning product data...')
    const cleanedProductData = {
      ...productData,
      description: description, // Use the validated description
      variants: productData.variants?.map((variant: any) => {
        const cleanedVariant = { ...variant }
        // Don't force inventory_management to 'shopify' - respect the user's choice
        // Keep inventory_tracking for later use in variant creation
        if (cleanedVariant.option1 === null || cleanedVariant.option1 === '') {
          cleanedVariant.option1 = 'Default'
        }
        if (cleanedVariant.option2 === null || cleanedVariant.option2 === '') {
          cleanedVariant.option2 = 'Default'
        }
        if (cleanedVariant.option3 === null || cleanedVariant.option3 === '') {
          cleanedVariant.option3 = 'Default'
        }
        return cleanedVariant
      }) || []
    }
    console.log('Cleaned product data:', JSON.stringify(cleanedProductData, null, 2))

    // Create product in Shopify using GraphQL API
    console.log('Step 11: Setting up GraphQL API...')
    const graphqlUrl = `https://${shopifyDomain}/admin/api/2025-10/graphql.json`
    console.log('GraphQL URL:', graphqlUrl)
    
    // Use productOptions from payload if provided, otherwise build from variants
    let productOptions: any[] = []
    
    if (cleanedProductData.productOptions && Array.isArray(cleanedProductData.productOptions)) {
      // Use productOptions directly from the payload (GraphQL format)
      productOptions = cleanedProductData.productOptions
      console.log('Using productOptions from payload:', JSON.stringify(productOptions, null, 2))
    } else if (cleanedProductData.variants && cleanedProductData.variants.length > 0) {
      // Build options from variants (legacy format)
      // All variants use option1 which represents "Size"
      const sizeValues = new Set<string>()
      
      cleanedProductData.variants.forEach((variant: any) => {
        if (variant.option1 && variant.option1.trim() && variant.option1 !== 'Default') {
          sizeValues.add(variant.option1.trim())
        }
      })
      
      // Convert to productOptions format: [{name: "Size", values: [{name: "Small"}, {name: "Large"}]}]
      if (sizeValues.size > 0) {
        const optionValues = Array.from(sizeValues)
          .filter((value: string) => value && value.trim())
          .map((value: string) => ({ name: value.trim() }))
        
        if (optionValues.length > 0) {
          productOptions.push({
            name: 'Size',
            values: optionValues
          })
        }
      }
      
      console.log('Built product options from variants:', JSON.stringify(productOptions, null, 2))
    }

    // Escape strings for GraphQL
    const escapeGraphQL = (str: string) => str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')
    
    // Build productOptions string for inline mutation
    const productOptionsString = productOptions.length > 0 
      ? `, productOptions: [${productOptions.map(opt => 
          `{name: "${escapeGraphQL(opt.name)}", values: [${opt.values.map((v: any) => `{name: "${escapeGraphQL(v.name)}"}`).join(', ')}]}`
        ).join(', ')}]`
      : ''
    
    // Handle tags - convert array to comma-separated string if needed
    const tagsString = Array.isArray(cleanedProductData.tags) 
      ? cleanedProductData.tags.join(', ')
      : cleanedProductData.tags
    
    // Build inline GraphQL mutation (like the example)
    const graphqlMutation = `
      mutation {
        productCreate(product: {
          title: "${escapeGraphQL(cleanedProductData.title)}"
          ${cleanedProductData.description ? `descriptionHtml: "${escapeGraphQL(cleanedProductData.description)}"` : ''}
          ${cleanedProductData.vendor ? `vendor: "${escapeGraphQL(cleanedProductData.vendor)}"` : ''}
          ${cleanedProductData.product_type ? `productType: "${escapeGraphQL(cleanedProductData.product_type)}"` : ''}
          ${tagsString ? `tags: "${escapeGraphQL(tagsString)}"` : ''}
          ${productOptionsString}
        }) {
          product {
            id
            title
            handle
            status
            descriptionHtml
            vendor
            productType
            tags
            options {
              id
              name
              position
              optionValues {
                id
                name
                hasVariants
              }
            }
            variants(first: 100) {
              nodes {
                id
                title
                price
                sku
                inventoryQuantity
                selectedOptions {
                  name
                  value
                }
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `
    
    console.log('Creating product in Shopify:', productData.title)
    console.log('GraphQL mutation:', graphqlMutation)
    
    // Prepare request details
    const requestHeaders = {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    }
    const requestBody = {
      query: graphqlMutation
    }
    
    // Log the complete request
    console.log('\n========== PRODUCT CREATE REQUEST ==========')
    console.log('URL:', graphqlUrl)
    console.log('Method: POST')
    console.log('\nHeaders:')
    console.log(JSON.stringify({
      ...requestHeaders,
      'X-Shopify-Access-Token': accessToken.substring(0, 10) + '...' // Only show first 10 chars for security
    }, null, 2))
    console.log('\nBody:')
    console.log(JSON.stringify(requestBody, null, 2))
    console.log('==========================================\n')
    
    const shopifyResponse = await fetch(graphqlUrl, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify(requestBody),
    })
    
    // Ensure we have a response
    if (!shopifyResponse) {
      const errorResponse = NextResponse.json(
        { error: 'Failed to get response from Shopify' },
        { status: 500 }
      )
      return addCorsHeaders(errorResponse)
    }

    console.log('Shopify response status:', shopifyResponse.status)

    if (!shopifyResponse.ok) {
      const errorData = await shopifyResponse.text()
      console.error('Shopify GraphQL error:', shopifyResponse.status, errorData)
      
      const errorResponse = NextResponse.json(
        { error: 'Failed to create product in Shopify', details: errorData },
        { status: shopifyResponse.status }
      )
      return addCorsHeaders(errorResponse)
    }

    const shopifyResponseData = await shopifyResponse.json()
    console.log('Shopify GraphQL response:', JSON.stringify(shopifyResponseData, null, 2))
    
    // Handle GraphQL response
    if (shopifyResponseData.errors) {
      console.error('GraphQL errors:', shopifyResponseData.errors)
      const errorResponse = NextResponse.json(
        { error: 'GraphQL errors occurred', details: shopifyResponseData.errors },
        { status: 400 }
      )
      return addCorsHeaders(errorResponse)
    }
    
    const productCreateResult = shopifyResponseData.data?.productCreate
    if (!productCreateResult) {
      console.error('No productCreate result in response:', shopifyResponseData)
      const errorResponse = NextResponse.json(
        { error: 'Invalid GraphQL response structure', details: shopifyResponseData },
        { status: 500 }
      )
      return addCorsHeaders(errorResponse)
    }
    
    // Check for user errors
    if (productCreateResult.userErrors && productCreateResult.userErrors.length > 0) {
      console.error('User errors:', productCreateResult.userErrors)
      const errorResponse = NextResponse.json(
        { error: 'Product creation failed', userErrors: productCreateResult.userErrors },
        { status: 400 }
      )
      return addCorsHeaders(errorResponse)
    }
    
    const shopifyProduct = productCreateResult.product
    if (!shopifyProduct || !shopifyProduct.id) {
      console.error('No product created. Response structure:', shopifyResponseData)
      const errorResponse = NextResponse.json(
        { error: 'Product creation failed - no product ID returned from Shopify', details: shopifyResponseData },
        { status: 500 }
      )
      return addCorsHeaders(errorResponse)
    }
    
    // Transform GraphQL response to match expected format
    const productId = parseInt(shopifyProduct.id.split('/').pop()) || 0
    const finalProductData = {
      id: productId,
      gid: shopifyProduct.id, // Include full GID for GraphQL operations
      title: shopifyProduct.title,
      handle: shopifyProduct.handle,
      body_html: shopifyProduct.descriptionHtml,
      vendor: shopifyProduct.vendor,
      product_type: shopifyProduct.productType,
      tags: shopifyProduct.tags.join(', '),
      status: shopifyProduct.status.toLowerCase(),
      options: shopifyProduct.options?.map((option: any) => ({
        id: parseInt(option.id.split('/').pop()) || 0,
        name: option.name,
        position: option.position,
        optionValues: option.optionValues.map((optionValue: any) => ({
          id: parseInt(optionValue.id.split('/').pop()) || 0,
          name: optionValue.name,
          hasVariants: optionValue.hasVariants
        }))
      })) || [],
      variants: shopifyProduct.variants.nodes.map((variant: any) => ({
        id: parseInt(variant.id.split('/').pop()) || 0,
        title: variant.title,
        price: variant.price,
        sku: variant.sku,
        inventory_quantity: variant.inventoryQuantity,
        option1: variant.selectedOptions[0]?.value || null,
        option2: variant.selectedOptions[1]?.value || null,
        option3: variant.selectedOptions[2]?.value || null
      }))
    }

    console.log('Product created successfully in Shopify with ID:', productId)
    console.log('Product created with options:', JSON.stringify(shopifyProduct.options, null, 2))
    
    // Step 1: Add images if provided
    if (cleanedProductData.images && cleanedProductData.images.length > 0) {
      console.log('Adding images to product...')
      try {
        const imagesMutation = `
          mutation productCreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
            productCreateMedia(productId: $productId, media: $media) {
              media {
                id
                alt
                mediaContentType
              }
              mediaUserErrors {
                  field
                  message
                }
              }
            }
          `

        const imagesResponse = await fetch(graphqlUrl, {
            method: 'POST',
            headers: {
              'X-Shopify-Access-Token': accessToken,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
            query: imagesMutation,
              variables: {
                productId: shopifyProduct.id,
              media: cleanedProductData.images.map((img: any) => ({
                originalSource: img.src,
                alt: img.alt || cleanedProductData.title,
                mediaContentType: 'IMAGE'
              }))
              }
            }),
          })

        if (imagesResponse.ok) {
          const imagesData = await imagesResponse.json()
          console.log('Images added successfully:', imagesData)
          } else {
          console.warn('Failed to add images')
        }
      } catch (imageError) {
        console.warn('Error adding images:', imageError)
      }
    }
    
    // Step 2: Create/Update variants with prices using productVariantsBulkCreate
    if (cleanedProductData.variants && cleanedProductData.variants.length > 0) {
      console.log('\n========== CREATING VARIANTS WITH PRICES ==========')
      console.log('Number of input variants:', cleanedProductData.variants.length)
      console.log('\nInput variants with prices and inventory tracking:', JSON.stringify(cleanedProductData.variants.map((v: any) => ({
        option1: v.option1,
        price: v.price,
        sku: v.sku,
        inventory_tracking: v.inventory_tracking,
        inventory_management: v.inventory_management
      })), null, 2))
      
      try {
        // Build variants array for bulk create
        const variantsInput = cleanedProductData.variants.map((inputVariant: any) => {
          const variantInput: any = {
            price: inputVariant.price || '0.00'
          }
          
          // Add SKU if provided
          if (inputVariant.sku) {
            variantInput.sku = inputVariant.sku
          }
          
          // Set inventory tracking based on user's choice
          // inventory_tracking is a boolean from the frontend
          // We use the inventoryItem.tracked field in GraphQL
          if (typeof inputVariant.inventory_tracking === 'boolean') {
            variantInput.inventoryItem = {
              tracked: inputVariant.inventory_tracking
            }
          }
          
          // Add option values - for single Size option, just use option1
          variantInput.optionValues = []
          if (inputVariant.option1) {
            variantInput.optionValues.push({
              optionName: 'Size',
              name: inputVariant.option1
            })
          }
          
          return variantInput
        })
        
        console.log('Variants input for bulk create:', JSON.stringify(variantsInput, null, 2))
        
        const variantsBulkCreateMutation = `
          mutation productVariantsBulkCreate($productId: ID!, $variants: [ProductVariantsBulkInput!]!, $strategy: ProductVariantsBulkCreateStrategy) {
            productVariantsBulkCreate(productId: $productId, variants: $variants, strategy: $strategy) {
              productVariants {
                id
                title
                price
                sku
                inventoryQuantity
                inventoryItem {
                  id
                  tracked
                }
                selectedOptions {
                  name
                  value
                }
              }
              userErrors {
                field
                message
              }
            }
          }
        `

        const variantsResponse = await fetch(graphqlUrl, {
          method: 'POST',
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: variantsBulkCreateMutation,
            variables: {
              productId: shopifyProduct.id,
              variants: variantsInput,
              strategy: 'REMOVE_STANDALONE_VARIANT' // Replace the default variant created by productCreate
            }
          }),
        })

        if (variantsResponse.ok) {
          const variantsData = await variantsResponse.json()
          console.log('Variants bulk create response:', JSON.stringify(variantsData, null, 2))
          
          if (variantsData.errors) {
            console.error('❌ GraphQL errors:', variantsData.errors)
          } else if (variantsData.data?.productVariantsBulkCreate?.userErrors?.length > 0) {
            console.error('❌ Variant creation errors:', variantsData.data.productVariantsBulkCreate.userErrors)
          } else if (variantsData.data?.productVariantsBulkCreate?.productVariants) {
            const createdVariants = variantsData.data.productVariantsBulkCreate.productVariants
            console.log(`✅ ${createdVariants.length} variants created successfully:`)
            createdVariants.forEach((v: any) => {
              const inventoryTracked = v.inventoryItem?.tracked ? 'Tracked' : 'Untracked'
              console.log(`   - ${v.title}: $${v.price} (SKU: ${v.sku || 'N/A'}, Inventory: ${inventoryTracked})`)
            })
            
            // Update finalProductData with new variants
            finalProductData.variants = createdVariants.map((variant: any) => ({
              id: parseInt(variant.id.split('/').pop()) || 0,
              title: variant.title,
              price: variant.price,
              sku: variant.sku,
              inventory_quantity: variant.inventoryQuantity,
              option1: variant.selectedOptions[0]?.value || null,
              option2: variant.selectedOptions[1]?.value || null,
              option3: variant.selectedOptions[2]?.value || null
            }))
          } else {
            console.warn('⚠️ Unexpected response structure:', variantsData)
          }
        } else {
          const errorText = await variantsResponse.text()
          console.error(`❌ Failed to create variants`)
          console.error('Response status:', variantsResponse.status)
          console.error('Response body:', errorText)
        }
        
        console.log('\n========== VARIANT CREATION COMPLETE ==========\n')
      } catch (variantError) {
        console.error('❌ Error creating variants:', variantError)
        console.error('Error stack:', variantError instanceof Error ? variantError.stack : 'No stack trace')
      }
    }

    console.log('API used: GraphQL')

    const response = NextResponse.json({ 
      success: true,
      product: finalProductData,
      message: 'Product created successfully',
      apiUsed: 'GraphQL'
    })
    return addCorsHeaders(response)
  } catch (error: any) {
    console.error('=== ERROR IN PRODUCT CREATION ===')
    console.error('Error type:', typeof error)
    console.error('Error message:', error.message)
    console.error('Error stack:', error.stack)
    console.error('Full error object:', JSON.stringify(error, null, 2))
    
    if (error.message === 'No authorization token provided') {
      console.log('Authentication error - no token provided')
      const response = NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
      return addCorsHeaders(response)
    }
    
    // Handle Firebase initialization errors with 400 status for better debugging
    if (error.message === 'Firebase Admin SDK not initialized') {
      console.log('Firebase initialization error - returning 400')
      const response = NextResponse.json(
        { 
          error: 'Firebase not configured',
          message: 'Firebase Admin SDK is not properly initialized. Please check your environment variables.',
          details: 'Check FIREBASE_ADMIN_PRIVATE_KEY and other Firebase configuration variables.'
        },
        { status: 400 }
      )
      return addCorsHeaders(response)
    }
    
    // For other errors, return 400 to help with debugging
    console.log('Returning 400 error response for better debugging')
    const response = NextResponse.json(
      { 
        error: 'Product creation failed',
        message: 'An error occurred while creating the product',
        details: error.message,
        type: typeof error,
        debug: {
          firebaseAuth: auth ? 'initialized' : 'not initialized',
          firebaseDb: db ? 'initialized' : 'not initialized'
        }
      },
      { status: 400 }
    )
    return addCorsHeaders(response)
  }
}

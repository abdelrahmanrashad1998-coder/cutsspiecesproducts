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
    const shopifyDomain = shopData.shopifyDomain
    const accessToken = shopData.shopifyAccessToken

    if (!shopifyDomain || !accessToken) {
      const errorResponse = NextResponse.json(
        { error: 'Shop credentials not found' },
        { status: 400 }
      )
      return addCorsHeaders(errorResponse)
    }

    // Make request to Shopify API
    const shopifyResponse = await fetch(`https://${shopifyDomain}/admin/api/2025-07/products.json`, {
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
      const graphqlUrl = `https://${shopifyDomain}/admin/api/2025-07/graphql.json`
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
      hasBodyHtml: !!productData.body_html,
      vendor: productData.vendor,
      tags: productData.tags,
      variantsCount: productData.variants?.length || 0,
      imagesCount: productData.images?.length || 0,
      variants: productData.variants
    })
    
    if (!productData.title || !productData.body_html) {
      console.log('Validation failed: missing title or body_html')
      const response = NextResponse.json(
        { 
          error: 'Title and description are required',
          received: {
            title: productData.title,
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
    const shopifyDomain = shopData.shopifyDomain
    const accessToken = shopData.shopifyAccessToken

    if (!shopifyDomain || !accessToken) {
      console.log('Missing shop credentials:', { hasDomain: !!shopifyDomain, hasToken: !!accessToken })
      const response = NextResponse.json(
        { error: 'Shop credentials not found' },
        { status: 400 }
      )
      return addCorsHeaders(response)
    }

    // Clean up the product data for Shopify API - replace null values with defaults
    console.log('Step 10: Cleaning product data...')
    const cleanedProductData = {
      ...productData,
      variants: productData.variants?.map((variant: any) => {
        const cleanedVariant = { ...variant }
        // Replace null values with appropriate defaults
        if (cleanedVariant.inventory_management === null) {
          cleanedVariant.inventory_management = 'shopify'
        }
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
    const graphqlUrl = `https://${shopifyDomain}/admin/api/2025-07/graphql.json`
    console.log('GraphQL URL:', graphqlUrl)
    
    // Build optimized GraphQL mutation
    const graphqlMutation = `
      mutation productCreate($product: ProductCreateInput!, $media: [CreateMediaInput!]) {
        productCreate(product: $product, media: $media) {
          product {
            id
            title
            handle
            status
            descriptionHtml
            vendor
            productType
            tags
            media(first: 10) {
              nodes {
                id
                alt
                mediaContentType
                preview {
                  status
                }
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
            options {
              id
              name
              position
              values
              optionValues {
                id
                name
                hasVariants
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
    
    // Create product options if we have variants with options
    const productOptions: any[] = []
    if (cleanedProductData.variants && cleanedProductData.variants.length > 0) {
      // Check if we have any options defined
      const hasOptions = cleanedProductData.variants.some((variant: any) => 
        variant.option1 || variant.option2 || variant.option3
      )
      
      if (hasOptions) {
        // Create options based on the variants - use more meaningful names
        const optionMap = new Map()
        
        cleanedProductData.variants.forEach((variant: any) => {
          if (variant.option1 && variant.option1.trim()) {
            if (!optionMap.has('Size')) optionMap.set('Size', new Set())
            optionMap.get('Size').add(variant.option1.trim())
          }
          if (variant.option2 && variant.option2.trim()) {
            if (!optionMap.has('Color')) optionMap.set('Color', new Set())
            optionMap.get('Color').add(variant.option2.trim())
          }
          if (variant.option3 && variant.option3.trim()) {
            if (!optionMap.has('Material')) optionMap.set('Material', new Set())
            optionMap.get('Material').add(variant.option3.trim())
          }
        })
        
        // Convert to product options format
        optionMap.forEach((values, optionName) => {
          if (values.size > 0) {
            const optionValues = Array.from(values)
              .filter((value: any) => value && typeof value === 'string' && value.trim()) // Filter out empty values
              .map((value: any) => ({ name: (value as string).trim() }))
            
            // Only add option if we have valid values
            if (optionValues.length > 0) {
              productOptions.push({
                name: optionName,
                values: optionValues
              })
            }
          }
        })
        
        console.log('Created product options:', productOptions)
      }
    }

    // If no valid options were created, create a simple default option
    if (productOptions.length === 0 && cleanedProductData.variants && cleanedProductData.variants.length > 0) {
      const firstVariant = cleanedProductData.variants[0]
      if (firstVariant.price && firstVariant.price !== '0.00') {
        // Create a simple default option for single variant products
        productOptions.push({
          name: 'Default',
          values: [{ name: 'Default' }]
        })
        console.log('Created default option for single variant product')
      }
    }

    const graphqlVariables = {
      product: {
        title: cleanedProductData.title,
        descriptionHtml: cleanedProductData.body_html,
        vendor: cleanedProductData.vendor,
        tags: cleanedProductData.tags ? cleanedProductData.tags.split(',').map((tag: string) => tag.trim()) : [],
        productType: cleanedProductData.product_type || '',
        ...(productOptions.length > 0 && { productOptions: productOptions })
      }
    }

    // Handle media separately if images exist
    let mediaVariables = null
    if (cleanedProductData.images && cleanedProductData.images.length > 0) {
      mediaVariables = {
        media: cleanedProductData.images.map((img: any) => ({
          originalSource: img.src,
          alt: img.alt || cleanedProductData.title,
          mediaContentType: 'IMAGE'
        }))
      }
    }

    console.log('Creating product in Shopify:', productData.title)
    console.log('GraphQL variables:', JSON.stringify(graphqlVariables, null, 2))
    if (mediaVariables) {
      console.log('Media variables:', JSON.stringify(mediaVariables, null, 2))
    }
    
    // Combine variables for the request
    const requestVariables: any = { ...graphqlVariables }
    if (mediaVariables) {
      requestVariables.media = mediaVariables.media
    }
    
    const shopifyResponse = await fetch(graphqlUrl, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: graphqlMutation,
        variables: requestVariables
      }),
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
      title: shopifyProduct.title,
      handle: shopifyProduct.handle,
      body_html: shopifyProduct.descriptionHtml,
      vendor: shopifyProduct.vendor,
      product_type: shopifyProduct.productType,
      tags: shopifyProduct.tags.join(', '),
      status: shopifyProduct.status.toLowerCase(),
      images: shopifyProduct.media?.nodes?.map((media: any) => ({
        id: parseInt(media.id.split('/').pop()) || 0,
        src: media.originalSource || '', // Note: This might need to be fetched separately for the actual URL
        alt: media.alt || ''
      })) || [],
      variants: shopifyProduct.variants.nodes.map((variant: any) => ({
        id: parseInt(variant.id.split('/').pop()) || 0,
        title: variant.title,
        price: variant.price,
        sku: variant.sku,
        inventory_quantity: variant.inventoryQuantity,
        option1: variant.selectedOptions[0]?.value || 'Default',
        option2: variant.selectedOptions[1]?.value || null,
        option3: variant.selectedOptions[2]?.value || null
      }))
    }

    console.log('Product created successfully in Shopify with ID:', productId)
    
    // Update the initial variant's price if we have variant data
    if (cleanedProductData.variants && cleanedProductData.variants.length > 0) {
      const firstVariant = cleanedProductData.variants[0]
      if (firstVariant.price && firstVariant.price !== '0.00') {
        console.log('Updating initial variant price to:', firstVariant.price)
        
        try {
          // Update the first variant's price using bulk update
          const variantUpdateMutation = `
            mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
              productVariantsBulkUpdate(productId: $productId, variants: $variants) {
                productVariants {
                  id
                  title
                  price
                  sku
                  inventoryQuantity
                }
                userErrors {
                  field
                  message
                }
              }
            }
          `

          const variantUpdateResponse = await fetch(graphqlUrl, {
            method: 'POST',
            headers: {
              'X-Shopify-Access-Token': accessToken,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              query: variantUpdateMutation,
              variables: {
                productId: shopifyProduct.id,
                variants: [{
                  id: shopifyProduct.variants.nodes[0].id,
                  price: firstVariant.price,
                  sku: firstVariant.sku || '',
                  inventoryQuantity: firstVariant.inventory_quantity || 0
                }]
              }
            }),
          })

          if (variantUpdateResponse.ok) {
            const variantUpdateData = await variantUpdateResponse.json()
            console.log('Variant price updated successfully:', variantUpdateData)
            
            // Update the final product data with the correct price
            if (variantUpdateData.data?.productVariantsBulkUpdate?.productVariants?.[0]) {
              finalProductData.variants[0].price = variantUpdateData.data.productVariantsBulkUpdate.productVariants[0].price
              console.log('Updated final product data with correct price:', finalProductData.variants[0].price)
            }
          } else {
            console.warn('Failed to update variant price, but product was created successfully')
          }
        } catch (variantUpdateError) {
          console.warn('Error updating variant price:', variantUpdateError)
          // Fallback: Update the final product data with the intended price
          finalProductData.variants[0].price = firstVariant.price
          console.log('Updated final product data with fallback price:', firstVariant.price)
        }
      }
    }
    
    // If we have multiple variants with different options, create additional variants
    if (cleanedProductData.variants && cleanedProductData.variants.length > 1) {
      console.log('Creating additional variants...')
      try {
        // Create variants using productVariantsBulkCreate
        const variantInputs = cleanedProductData.variants.slice(1).map((variant: any) => ({
          price: variant.price || '0.00',
          sku: variant.sku || '',
          inventoryQuantity: variant.inventory_quantity || 0,
          inventoryManagement: variant.inventory_management || 'shopify',
          option1: variant.option1 || null,
          option2: variant.option2 || null,
          option3: variant.option3 || null
        }))

        const variantsMutation = `
          mutation productVariantsBulkCreate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
            productVariantsBulkCreate(productId: $productId, variants: $variants) {
              productVariants {
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
            query: variantsMutation,
            variables: {
              productId: shopifyProduct.id,
              variants: variantInputs
            }
          }),
        })

        if (variantsResponse.ok) {
          const variantsData = await variantsResponse.json()
          console.log('Additional variants created:', variantsData)
        } else {
          console.warn('Failed to create additional variants, but product was created successfully')
        }
      } catch (variantError) {
        console.warn('Error creating additional variants:', variantError)
        // Don't fail the entire operation if variant creation fails
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

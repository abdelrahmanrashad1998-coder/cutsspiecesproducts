import { NextRequest, NextResponse } from 'next/server'
import { analyzeProductImages } from '@/lib/openai'
import { db, auth } from '@/lib/firebase-admin'

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
    throw new Error('No valid authorization token provided')
  }
  return authHeader.substring(7)
}

export async function POST(request: NextRequest) {
  try {
    const token = await verifyAuthToken(request)
    const { imageUrls, model: modelFromRequest, shopId } = await request.json()
    
    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      const response = NextResponse.json(
        { error: 'No image URLs provided' },
        { status: 400 }
      )
      return addCorsHeaders(response)
    }

    // Resolve user identity (uid) if possible
    let uid: string | null = null
    if (auth) {
      try {
        const decoded = await auth.verifyIdToken(token)
        uid = decoded.uid
      } catch (e) {
        uid = null
      }
    }

    // Fetch OpenAI settings: prefer UID doc, fallback to legacy token doc
    let openaiApiKey = ''
    let openaiModel: string | undefined = undefined
    try {
      if (db) {
        if (uid) {
          const byUidRef = db.collection('userSettings').doc(uid)
          const byUidSnap = await byUidRef.get()
          if (byUidSnap.exists) {
            const s = byUidSnap.data() as any
            openaiApiKey = s?.openaiApiKey || ''
            openaiModel = s?.openaiModel
          }
        }

        if (!openaiApiKey) {
          const byTokenRef = db.collection('userSettings').doc(token)
          const byTokenSnap = await byTokenRef.get()
          if (byTokenSnap.exists) {
            const s = byTokenSnap.data() as any
            openaiApiKey = s?.openaiApiKey || ''
            openaiModel = openaiModel || s?.openaiModel
          }
        }
      }
    } catch (dbError) {
      console.warn('Failed to fetch user settings:', dbError)
    }

    // Fallback to environment variable if no user settings found
    if (!openaiApiKey) {
      openaiApiKey = process.env.OPENAI_API_KEY || ''
    }

    if (!openaiApiKey) {
      const response = NextResponse.json(
        { error: 'OpenAI API key not configured. Please set your API key in Settings or environment variables.' },
        { status: 400 }
      )
      return addCorsHeaders(response)
    }

    const modelToUse = modelFromRequest || openaiModel || 'gpt-4o'

    // Fetch store description, currency, and collections if shopId is provided
    let storeDescription = ''
    let storeCurrency = 'USD'
    let availableCollections: any[] = []
    if (shopId && db) {
      try {
        const shopDoc = await db.collection('shops').doc(shopId).get()
        if (shopDoc.exists) {
          const shopData = shopDoc.data()
          storeDescription = shopData?.storeDescription || ''
          storeCurrency = shopData?.currency || 'USD'
          console.log('Fetched store description:', storeDescription)
          console.log('Fetched store currency:', storeCurrency)
          
          // Fetch collections for this shop
          if (shopData?.shopifyDomain && shopData?.shopifyAccessToken) {
            try {
              // Make direct API call to Shopify instead of internal API to avoid circular dependency
              const shopifyDomain = shopData.shopifyDomain
              const accessToken = shopData.shopifyAccessToken
              
              // Convert custom domain to myshopify domain if needed
              let domainToUse = shopifyDomain
              if (shopifyDomain === 'cutts-pieces.com') {
                domainToUse = 'v4b0fh-da.myshopify.com'
              }
              
              const graphqlUrl = `https://${domainToUse}/admin/api/2025-07/graphql.json`
              const graphqlQuery = {
                query: `
                  query {
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
                `
              }
              
              const collectionsResponse = await fetch(graphqlUrl, {
                method: 'POST',
                headers: {
                  'X-Shopify-Access-Token': accessToken,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(graphqlQuery)
              })
              
              if (collectionsResponse.ok) {
                const collectionsData = await collectionsResponse.json()
                availableCollections = collectionsData.data?.collections?.edges?.map((edge: any) => ({
                  id: parseInt(edge.node.id.split('/').pop()) || 0,
                  title: edge.node.title,
                  handle: edge.node.handle
                })) || []
                console.log('Fetched collections:', availableCollections.length)
              }
            } catch (collectionsError) {
              console.warn('Failed to fetch collections:', collectionsError)
            }
          }
        } else {
          console.log('Shop not found for shopId:', shopId)
        }
      } catch (shopError) {
        console.warn('Failed to fetch store description:', shopError)
      }
    } else {
      console.log('No shopId provided or db not available')
    }

    // Convert local URLs to full URLs for AI analysis
    const fullImageUrls = imageUrls.map(url => {
      if (url.startsWith('/uploads/')) {
        // Convert local URL to full URL
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
        return `${baseUrl}${url}`
      }
      return url
    })

    console.log('Analyzing images with:', {
      imageUrls: fullImageUrls,
      modelToUse,
      hasStoreDescription: !!storeDescription,
      storeDescription: storeDescription.substring(0, 100) + (storeDescription.length > 100 ? '...' : ''),
      storeCurrency,
      collectionsCount: availableCollections.length
    })

    const analysis = await analyzeProductImages(fullImageUrls, openaiApiKey, modelToUse, storeDescription, availableCollections, storeCurrency)
    
    console.log('Analysis result:', analysis)
    
    const response = NextResponse.json({ success: true, analysis })
    return addCorsHeaders(response)

  } catch (error) {
    console.error('Error analyzing images:', error)
    if (error instanceof Error) {
      if (error.message.includes('No valid authorization token')) {
        const response = NextResponse.json({ error: 'Authentication required' }, { status: 401 })
        return addCorsHeaders(response)
      }
      if (error.message.includes('Firebase')) {
        const response = NextResponse.json({ error: 'Database connection error' }, { status: 500 })
        return addCorsHeaders(response)
      }
      if (error.message.includes('OpenAI')) {
        const response = NextResponse.json({ error: 'AI analysis service error' }, { status: 500 })
        return addCorsHeaders(response)
      }
    }
    const response = NextResponse.json({ error: 'Failed to analyze images' }, { status: 500 })
    return addCorsHeaders(response)
  }
}



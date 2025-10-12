import { NextRequest, NextResponse } from 'next/server'
import { analyzeProductImages } from '@/lib/openai'
import { db, auth } from '@/lib/firebase-admin'

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
      return NextResponse.json(
        { error: 'No image URLs provided' },
        { status: 400 }
      )
    }

    // Use system-wide OpenAI API key from environment
    const openaiApiKey = process.env.OPENAI_API_KEY || ''
    
    if (!openaiApiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured. Please contact your system administrator.' },
        { status: 500 }
      )
    }

    // Resolve user identity (uid) to fetch user-specific model preference
    let uid: string | null = null
    if (auth) {
      try {
        const decoded = await auth.verifyIdToken(token)
        uid = decoded.uid
      } catch (e) {
        uid = null
      }
    }

    // Fetch user's preferred OpenAI model
    let openaiModel: string | undefined = undefined
    try {
      if (db && uid) {
        const userSettingsRef = db.collection('userSettings').doc(uid)
        const userSettingsSnap = await userSettingsRef.get()
        if (userSettingsSnap.exists) {
          const settings = userSettingsSnap.data() as any
          openaiModel = settings?.openaiModel
        }
      }
    } catch (dbError) {
      console.warn('Failed to fetch user settings:', dbError)
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
              
              const graphqlUrl = `https://${domainToUse}/admin/api/2023-10/graphql.json`
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

    const analysis = await analyzeProductImages(fullImageUrls, modelToUse, storeDescription, availableCollections, storeCurrency)
    
    console.log('Analysis result:', analysis)
    
    return NextResponse.json({ success: true, analysis })

  } catch (error) {
    console.error('Error analyzing images:', error)
    if (error instanceof Error) {
      if (error.message.includes('No valid authorization token')) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
      }
      if (error.message.includes('Firebase')) {
        return NextResponse.json({ error: 'Database connection error' }, { status: 500 })
      }
      if (error.message.includes('OpenAI')) {
        return NextResponse.json({ error: 'AI analysis service error' }, { status: 500 })
      }
    }
    return NextResponse.json({ error: 'Failed to analyze images' }, { status: 500 })
  }
}



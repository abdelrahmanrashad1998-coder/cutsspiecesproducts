import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase-admin'
import { ProductData } from '@/lib/firestore-admin'

async function verifyAuthToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('No valid authorization token provided')
  }
  return authHeader.substring(7)
}

export async function GET(request: NextRequest) {
  try {
    const token = await verifyAuthToken(request)
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const shopId = searchParams.get('shopId')
    const limit = parseInt(searchParams.get('limit') || '5', 10)

    console.log('Fetching recent products for userId:', userId, 'shopId:', shopId)

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    try {
      let query = db.collection('products').where('userId', '==', userId)
      
      // If shopId is provided, filter by shop
      if (shopId) {
        query = query.where('shopId', '==', shopId)
      }

      // Order by creation date (newest first) and limit results
      const productsSnapshot = await query
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get()

      const products: ProductData[] = productsSnapshot.docs.map(doc => {
        const data = doc.data()
        return {
          ...data,
          createdAt: data.createdAt?.toDate?.() || data.createdAt,
          updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
        } as ProductData
      })

      console.log(`Found ${products.length} recent products`)
      return NextResponse.json({ products })
    } catch (queryError: any) {
      // Handle Firestore index error
      if (queryError.code === 9 || queryError.message?.includes('index')) {
        console.error('Firestore index required. Falling back to unordered query.')
        
        // Fallback: fetch without ordering
        let fallbackQuery = db.collection('products').where('userId', '==', userId)
        
        if (shopId) {
          fallbackQuery = fallbackQuery.where('shopId', '==', shopId)
        }
        
        const fallbackSnapshot = await fallbackQuery.limit(limit).get()
        
        const products: ProductData[] = fallbackSnapshot.docs.map(doc => {
          const data = doc.data()
          return {
            ...data,
            createdAt: data.createdAt?.toDate?.() || data.createdAt,
            updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
          } as ProductData
        })
        
        // Sort in memory
        products.sort((a, b) => {
          const dateA = new Date(a.createdAt).getTime()
          const dateB = new Date(b.createdAt).getTime()
          return dateB - dateA
        })
        
        console.log(`Found ${products.length} recent products (fallback query)`)
        return NextResponse.json({ 
          products: products.slice(0, limit),
          warning: 'Products fetched without Firestore index. Consider creating an index for better performance.'
        })
      }
      
      throw queryError
    }
  } catch (error) {
    console.error('Error fetching recent products:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('No valid authorization token')) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        )
      }
      
      console.error('Detailed error:', error.message, error.stack)
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch recent products', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}


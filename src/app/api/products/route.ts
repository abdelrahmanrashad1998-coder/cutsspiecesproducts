import { NextRequest, NextResponse } from 'next/server'
import { createProduct } from '@/lib/shopify'
import { createProductAdmin } from '@/lib/firestore-admin'

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
    // TODO: Implement product fetching logic
    return NextResponse.json({ products: [] })
  } catch (error) {
    console.error('Error fetching products:', error)
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = await verifyAuthToken(request)
    const productData = await request.json()
    
    // Validate required fields
    if (!productData.title || !productData.body_html) {
      return NextResponse.json(
        { error: 'Title and description are required' },
        { status: 400 }
      )
    }

    // Create product in Shopify
    const shopifyProduct = await createProduct(productData)
    
    // Save product to Firestore for local tracking
    const firestoreProduct = await createProductAdmin({
      shopifyId: shopifyProduct.id.toString(),
      title: shopifyProduct.title,
      description: shopifyProduct.body_html,
      vendor: shopifyProduct.vendor,
      category: shopifyProduct.product_type,
      images: shopifyProduct.images || [],
      variants: shopifyProduct.variants || [],
      userId: token, // Using token as userId for now
      isActive: true
    })

    return NextResponse.json({ 
      success: true,
      product: {
        id: shopifyProduct.id,
        ...shopifyProduct,
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

import { NextRequest, NextResponse } from 'next/server'
import { auth, db, isFirebaseInitialized } from '@/lib/firebase-admin'

// CORS headers helper
function addCorsHeaders(response: NextResponse) {
  response.headers.set('Access-Control-Allow-Origin', '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
  response.headers.set('Access-Control-Max-Age', '86400')
  return response
}

// Handle preflight requests
export async function OPTIONS() {
  console.log('CORS preflight request received')
  return addCorsHeaders(new NextResponse(null, { status: 200 }))
}

export async function GET(request: NextRequest) {
  try {
    console.log('Test endpoint called')
    
    const testResults = {
      timestamp: new Date().toISOString(),
      method: 'GET',
      firebaseInitialized: isFirebaseInitialized(),
      authService: auth ? 'Available' : 'Not Available',
      dbService: db ? 'Available' : 'Not Available',
      headers: {
        origin: request.headers.get('origin'),
        userAgent: request.headers.get('user-agent'),
        authorization: request.headers.get('authorization') ? 'Present' : 'Not Present'
      }
    }

    const response = NextResponse.json(testResults)
    return addCorsHeaders(response)
  } catch (error: any) {
    console.error('Test endpoint error:', error)
    
    const errorResponse = NextResponse.json({
      error: 'Test failed',
      message: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 })
    
    return addCorsHeaders(errorResponse)
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('Test POST endpoint called')
    
    const body = await request.json()
    console.log('Request body:', body)
    
    const testResults = {
      timestamp: new Date().toISOString(),
      method: 'POST',
      firebaseInitialized: isFirebaseInitialized(),
      authService: auth ? 'Available' : 'Not Available',
      dbService: db ? 'Available' : 'Not Available',
      receivedData: {
        hasTitle: !!body.title,
        hasDescription: !!body.body_html,
        hasImages: !!body.images,
        imageCount: body.images?.length || 0
      },
      headers: {
        origin: request.headers.get('origin'),
        userAgent: request.headers.get('user-agent'),
        authorization: request.headers.get('authorization') ? 'Present' : 'Not Present',
        contentType: request.headers.get('content-type')
      }
    }

    const response = NextResponse.json(testResults)
    return addCorsHeaders(response)
  } catch (error: any) {
    console.error('Test POST endpoint error:', error)
    
    const errorResponse = NextResponse.json({
      error: 'Test POST failed',
      message: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 })
    
    return addCorsHeaders(errorResponse)
  }
}

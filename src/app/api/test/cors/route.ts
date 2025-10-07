import { NextRequest, NextResponse } from 'next/server'

// CORS headers helper
function addCorsHeaders(response: NextResponse) {
  response.headers.set('Access-Control-Allow-Origin', '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
  response.headers.set('Access-Control-Max-Age', '86400')
  response.headers.set('Access-Control-Allow-Credentials', 'true')
  return response
}

// Handle preflight requests
export async function OPTIONS(request: NextRequest) {
  console.log('CORS preflight request received')
  console.log('Origin:', request.headers.get('origin'))
  console.log('Access-Control-Request-Method:', request.headers.get('access-control-request-method'))
  console.log('Access-Control-Request-Headers:', request.headers.get('access-control-request-headers'))
  
  return addCorsHeaders(new NextResponse(null, { status: 200 }))
}

export async function GET(request: NextRequest) {
  try {
    console.log('CORS test GET request received')
    
    const response = NextResponse.json({
      message: 'CORS test successful',
      timestamp: new Date().toISOString(),
      method: 'GET',
      origin: request.headers.get('origin'),
      userAgent: request.headers.get('user-agent')
    })
    
    return addCorsHeaders(response)
  } catch (error: any) {
    console.error('CORS test error:', error)
    
    const errorResponse = NextResponse.json({
      error: 'CORS test failed',
      message: error.message
    }, { status: 500 })
    
    return addCorsHeaders(errorResponse)
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('CORS test POST request received')
    
    const body = await request.json()
    
    const response = NextResponse.json({
      message: 'CORS test successful',
      timestamp: new Date().toISOString(),
      method: 'POST',
      origin: request.headers.get('origin'),
      userAgent: request.headers.get('user-agent'),
      receivedData: body
    })
    
    return addCorsHeaders(response)
  } catch (error: any) {
    console.error('CORS test POST error:', error)
    
    const errorResponse = NextResponse.json({
      error: 'CORS test POST failed',
      message: error.message
    }, { status: 500 })
    
    return addCorsHeaders(errorResponse)
  }
}

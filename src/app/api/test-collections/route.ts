import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  console.log('=== TEST COLLECTIONS API CALLED ===')
  console.log('Request URL:', request.url)
  
  return NextResponse.json({
    success: true,
    message: 'Test collections API is working',
    timestamp: new Date().toISOString(),
    url: request.url
  })
}

export async function POST(request: NextRequest) {
  try {
    console.log('=== TEST COLLECTIONS POST API CALLED ===')
    const body = await request.json()
    console.log('Request body:', body)
    
    return NextResponse.json({
      success: true,
      message: 'Test collections POST API is working',
      receivedData: body,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Test collections POST error:', error)
    return NextResponse.json(
      { error: 'Failed to parse request body' },
      { status: 400 }
    )
  }
}

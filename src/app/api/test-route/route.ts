import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  return NextResponse.json({ 
    message: 'API route is working',
    timestamp: new Date().toISOString(),
    url: request.url
  })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  return NextResponse.json({ 
    message: 'POST request received',
    data: body,
    timestamp: new Date().toISOString()
  })
}

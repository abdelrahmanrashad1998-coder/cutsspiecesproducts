import { NextRequest, NextResponse } from 'next/server'
import { db, auth } from '@/lib/firebase-admin'

export async function GET(request: NextRequest) {
  try {
    const debugInfo = {
      timestamp: new Date().toISOString(),
      firebaseAdmin: {
        db: db ? 'initialized' : 'not initialized',
        auth: auth ? 'initialized' : 'not initialized'
      },
      environment: {
        hasFirebaseAdminKey: !!process.env.FIREBASE_ADMIN_PRIVATE_KEY,
        hasOpenaiKey: !!process.env.OPENAI_API_KEY,
        nodeEnv: process.env.NODE_ENV
      }
    }

    return NextResponse.json(debugInfo)
  } catch (error) {
    console.error('Debug endpoint error:', error)
    return NextResponse.json(
      { 
        error: 'Debug endpoint failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

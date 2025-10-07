import { NextRequest, NextResponse } from 'next/server'
import { auth, db, isFirebaseInitialized } from '@/lib/firebase-admin'

export async function GET(request: NextRequest) {
  try {
    const diagnostics = {
      timestamp: new Date().toISOString(),
      firebaseInitialized: isFirebaseInitialized(),
      auth: auth ? 'initialized' : 'not initialized',
      db: db ? 'initialized' : 'not initialized',
      environment: {
        hasPrivateKey: !!process.env.FIREBASE_ADMIN_PRIVATE_KEY,
        hasPrivateKeyBase64: !!process.env.FIREBASE_ADMIN_PRIVATE_KEY_BASE64,
        hasProjectId: !!process.env.FIREBASE_PROJECT_ID,
        hasClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
        projectId: process.env.FIREBASE_PROJECT_ID || 'not set',
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL || 'not set'
      }
    }

    // Try to test database connection if available
    if (db) {
      try {
        const testDoc = await db.collection('_test').doc('connection').get()
        diagnostics.dbConnection = 'success'
      } catch (dbError) {
        diagnostics.dbConnection = 'failed'
        diagnostics.dbError = dbError instanceof Error ? dbError.message : 'Unknown error'
      }
    }

    return NextResponse.json(diagnostics)
  } catch (error) {
    return NextResponse.json({
      error: 'Diagnostic failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

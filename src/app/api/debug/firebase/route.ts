import { NextRequest, NextResponse } from 'next/server'
import { auth, db, isFirebaseInitialized } from '@/lib/firebase-admin'

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

export async function GET(request: NextRequest) {
  try {
    const diagnostics = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      firebaseInitialized: isFirebaseInitialized(),
      authService: auth ? 'Available' : 'Not Available',
      dbService: db ? 'Available' : 'Not Available',
      environmentVariables: {
        hasFirebaseAdminPrivateKey: !!process.env.FIREBASE_ADMIN_PRIVATE_KEY,
        hasFirebaseAdminPrivateKeyBase64: !!process.env.FIREBASE_ADMIN_PRIVATE_KEY_BASE64,
        hasFirebaseProjectId: !!process.env.FIREBASE_PROJECT_ID,
        hasFirebaseClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
        // Don't log actual values for security
        privateKeyLength: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.length || 0,
        base64KeyLength: process.env.FIREBASE_ADMIN_PRIVATE_KEY_BASE64?.length || 0,
      },
      deployment: {
        platform: process.env.VERCEL ? 'Vercel' : 'Other',
        region: process.env.VERCEL_REGION || 'Unknown',
        url: process.env.VERCEL_URL || 'Unknown'
      }
    }

    // Test Firestore connection if available
    if (db) {
      try {
        const testDoc = await db.collection('_test').doc('connection').get()
        diagnostics.firestoreConnection = 'Success'
        diagnostics.firestoreTest = {
          exists: testDoc.exists,
          timestamp: new Date().toISOString()
        }
      } catch (error: any) {
        diagnostics.firestoreConnection = 'Failed'
        diagnostics.firestoreError = {
          code: error.code,
          message: error.message,
          details: error.details || 'No additional details'
        }
      }
    } else {
      diagnostics.firestoreConnection = 'Database not initialized'
    }

    // Test Auth service if available
    if (auth) {
      try {
        // Just test if the service is accessible
        diagnostics.authConnection = 'Service Available'
      } catch (error: any) {
        diagnostics.authConnection = 'Failed'
        diagnostics.authError = {
          code: error.code,
          message: error.message
        }
      }
    } else {
      diagnostics.authConnection = 'Auth service not initialized'
    }

    const response = NextResponse.json(diagnostics)
    return addCorsHeaders(response)
  } catch (error: any) {
    console.error('Diagnostic error:', error)
    
    const errorResponse = NextResponse.json({
      error: 'Diagnostic failed',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 })
    
    return addCorsHeaders(errorResponse)
  }
}

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
    const testResults = {
      timestamp: new Date().toISOString(),
      firebaseInitialized: isFirebaseInitialized(),
      authService: auth ? 'Available' : 'Not Available',
      dbService: db ? 'Available' : 'Not Available',
      tests: {
        firestoreConnection: 'Not Tested',
        authService: 'Not Tested',
        shopsCollection: 'Not Tested'
      }
    }

    // Test Firestore connection
    if (db) {
      try {
        // Test basic Firestore connection
        const testDoc = await db.collection('_test').doc('connection').get()
        testResults.tests.firestoreConnection = 'Success'
        
        // Test shops collection access
        const shopsSnapshot = await db.collection('shops').limit(1).get()
        testResults.tests.shopsCollection = `Success (${shopsSnapshot.size} shops found)`
        
      } catch (error: any) {
        testResults.tests.firestoreConnection = `Failed: ${error.message}`
        testResults.tests.shopsCollection = `Failed: ${error.message}`
        testResults.firestoreError = {
          code: error.code,
          message: error.message
        }
      }
    } else {
      testResults.tests.firestoreConnection = 'Database not initialized'
      testResults.tests.shopsCollection = 'Database not initialized'
    }

    // Test Auth service
    if (auth) {
      try {
        // Just test if the service is accessible
        testResults.tests.authService = 'Service Available'
      } catch (error: any) {
        testResults.tests.authService = `Failed: ${error.message}`
        testResults.authError = {
          code: error.code,
          message: error.message
        }
      }
    } else {
      testResults.tests.authService = 'Auth service not initialized'
    }

    const response = NextResponse.json(testResults)
    return addCorsHeaders(response)
  } catch (error: any) {
    console.error('Test error:', error)
    
    const errorResponse = NextResponse.json({
      error: 'Test failed',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 })
    
    return addCorsHeaders(errorResponse)
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { db, auth } from '@/lib/firebase-admin'

export async function GET(request: NextRequest) {
  try {
    console.log('=== FIREBASE ADMIN DEBUG ===')
    console.log('Firebase Admin initialized:', !!auth)
    console.log('Firestore initialized:', !!db)
    
    if (!auth) {
      return NextResponse.json({
        success: false,
        message: 'Firebase Admin auth not initialized',
        error: 'FIREBASE_ADMIN_PRIVATE_KEY may be missing or invalid'
      }, { status: 500 })
    }
    
    if (!db) {
      return NextResponse.json({
        success: false,
        message: 'Firestore not initialized',
        error: 'Firebase Admin not properly configured'
      }, { status: 500 })
    }
    
    // Test basic Firestore connection
    try {
      const testRef = db.collection('_test').doc('connection')
      await testRef.set({ test: true, timestamp: new Date() })
      await testRef.delete()
      
      return NextResponse.json({
        success: true,
        message: 'Firebase Admin and Firestore are working correctly',
        auth: !!auth,
        db: !!db
      })
    } catch (firestoreError: any) {
      return NextResponse.json({
        success: false,
        message: 'Firestore connection failed',
        error: firestoreError.message,
        auth: !!auth,
        db: !!db
      }, { status: 500 })
    }
  } catch (error: any) {
    console.error('Firebase Admin debug error:', error)
    return NextResponse.json({
      success: false,
      message: 'Firebase Admin debug failed',
      error: error.message
    }, { status: 500 })
  }
}

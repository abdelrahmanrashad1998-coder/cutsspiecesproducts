import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/firebase-admin'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({
        success: false,
        message: 'No authorization header provided'
      }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    console.log('=== AUTH DEBUG ===')
    console.log('Token length:', token.length)
    console.log('Token starts with:', token.substring(0, 20) + '...')
    
    if (!auth) {
      return NextResponse.json({
        success: false,
        message: 'Firebase Admin auth not initialized'
      }, { status: 500 })
    }
    
    try {
      const decodedToken = await auth.verifyIdToken(token)
      console.log('Token verified successfully')
      console.log('User UID:', decodedToken.uid)
      console.log('User email:', decodedToken.email)
      
      return NextResponse.json({
        success: true,
        message: 'Token verified successfully',
        uid: decodedToken.uid,
        email: decodedToken.email,
        tokenLength: token.length
      })
    } catch (verifyError: any) {
      console.error('Token verification failed:', verifyError)
      return NextResponse.json({
        success: false,
        message: 'Token verification failed',
        error: verifyError.message,
        code: verifyError.code
      }, { status: 401 })
    }
  } catch (error: any) {
    console.error('Auth debug error:', error)
    return NextResponse.json({
      success: false,
      message: 'Auth debug failed',
      error: error.message
    }, { status: 500 })
  }
}


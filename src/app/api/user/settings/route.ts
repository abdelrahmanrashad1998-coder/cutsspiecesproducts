import { NextRequest, NextResponse } from 'next/server'
import { db, auth } from '@/lib/firebase-admin'

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

export interface UserSettings {
  openaiApiKey?: string
  openaiModel?: string
  defaultVendor?: 'store_name' | 'custom' | 'none'
  customVendor?: string
  updatedAt: Date
}

// GET user settings
export async function GET(request: NextRequest) {
  try {
    // Get user from Firebase Admin
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      return addCorsHeaders(response)
    }

    // Verify the Firebase ID token and get the user UID
    const token = authHeader.replace('Bearer ', '')
    let userId: string
    
    if (!auth) {
      const response = NextResponse.json({ error: 'Firebase Admin not initialized' }, { status: 500 })
      return addCorsHeaders(response)
    }
    
    try {
      const decodedToken = await auth.verifyIdToken(token)
      userId = decodedToken.uid
    } catch (error) {
      console.error('Error verifying token:', error)
      const response = NextResponse.json({ error: 'Invalid token' }, { status: 401 })
      return addCorsHeaders(response)
    }
    
    // Get user settings from Firestore using Admin SDK
    if (!db) {
      const response = NextResponse.json({ error: 'Database not available' }, { status: 500 })
      return addCorsHeaders(response)
    }
    
    const settingsRef = db.collection('userSettings').doc(userId)
    const settingsSnap = await settingsRef.get()
    
    if (settingsSnap.exists) {
      const settings = settingsSnap.data() as UserSettings
      const response = NextResponse.json(settings)
      return addCorsHeaders(response)
    } else {
      // Return default settings
      const response = NextResponse.json({
        openaiApiKey: '',
        openaiModel: 'gpt-4o',
        defaultVendor: 'store_name',
        customVendor: '',
        updatedAt: new Date()
      })
      return addCorsHeaders(response)
    }
  } catch (error) {
    console.error('Error fetching user settings:', error)
    const response = NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
    return addCorsHeaders(response)
  }
}

// POST/PUT user settings
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      return addCorsHeaders(response)
    }

    // Verify the Firebase ID token and get the user UID
    const token = authHeader.replace('Bearer ', '')
    let userId: string
    
    if (!auth) {
      const response = NextResponse.json({ error: 'Firebase Admin not initialized' }, { status: 500 })
      return addCorsHeaders(response)
    }
    
    try {
      const decodedToken = await auth.verifyIdToken(token)
      userId = decodedToken.uid
    } catch (error) {
      console.error('Error verifying token:', error)
      const response = NextResponse.json({ error: 'Invalid token' }, { status: 401 })
      return addCorsHeaders(response)
    }
    
    const body = await request.json()
    const { openaiApiKey, openaiModel, defaultVendor, customVendor } = body
    
    // Validate input
    if (openaiModel && !['gpt-4o', 'gpt-4o-mini', 'gpt-4', 'gpt-3.5-turbo'].includes(openaiModel)) {
      const response = NextResponse.json({ error: 'Invalid OpenAI model' }, { status: 400 })
      return addCorsHeaders(response)
    }
    
    if (defaultVendor && !['store_name', 'custom', 'none'].includes(defaultVendor)) {
      const response = NextResponse.json({ error: 'Invalid default vendor setting' }, { status: 400 })
      return addCorsHeaders(response)
    }
    
    // Save settings to Firestore using Admin SDK
    if (!db) {
      const response = NextResponse.json({ error: 'Database not available' }, { status: 500 })
      return addCorsHeaders(response)
    }
    
    const settingsRef = db.collection('userSettings').doc(userId)
    const settingsData: UserSettings = {
      openaiApiKey: openaiApiKey || '',
      openaiModel: openaiModel || 'gpt-4o',
      defaultVendor: defaultVendor || 'store_name',
      customVendor: customVendor || '',
      updatedAt: new Date()
    }
    
    await settingsRef.set(settingsData, { merge: true })
    
    const response = NextResponse.json({ success: true, settings: settingsData })
    return addCorsHeaders(response)
  } catch (error) {
    console.error('Error saving user settings:', error)
    const response = NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
    return addCorsHeaders(response)
  }
}

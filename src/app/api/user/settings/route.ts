import { NextRequest, NextResponse } from 'next/server'
import { db, auth } from '@/lib/firebase-admin'

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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify the Firebase ID token and get the user UID
    const token = authHeader.replace('Bearer ', '')
    let userId: string
    
    if (!auth) {
      return NextResponse.json({ error: 'Firebase Admin not initialized' }, { status: 500 })
    }
    
    try {
      const decodedToken = await auth.verifyIdToken(token)
      userId = decodedToken.uid
    } catch (error) {
      console.error('Error verifying token:', error)
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }
    
    // Get user settings from Firestore using Admin SDK
    if (!db) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 })
    }
    
    const settingsRef = db.collection('userSettings').doc(userId)
    const settingsSnap = await settingsRef.get()
    
    if (settingsSnap.exists) {
      const settings = settingsSnap.data() as UserSettings
      return NextResponse.json(settings)
    } else {
      // Return default settings
      return NextResponse.json({
        openaiApiKey: '',
        openaiModel: 'gpt-4o',
        defaultVendor: 'store_name',
        customVendor: '',
        updatedAt: new Date()
      })
    }
  } catch (error) {
    console.error('Error fetching user settings:', error)
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }
}

// POST/PUT user settings
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify the Firebase ID token and get the user UID
    const token = authHeader.replace('Bearer ', '')
    let userId: string
    
    if (!auth) {
      return NextResponse.json({ error: 'Firebase Admin not initialized' }, { status: 500 })
    }
    
    try {
      const decodedToken = await auth.verifyIdToken(token)
      userId = decodedToken.uid
    } catch (error) {
      console.error('Error verifying token:', error)
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }
    
    const body = await request.json()
    const { openaiApiKey, openaiModel, defaultVendor, customVendor } = body
    
    // Validate input
    if (openaiModel && !['gpt-4o', 'gpt-4o-mini', 'gpt-4', 'gpt-3.5-turbo'].includes(openaiModel)) {
      return NextResponse.json({ error: 'Invalid OpenAI model' }, { status: 400 })
    }
    
    if (defaultVendor && !['store_name', 'custom', 'none'].includes(defaultVendor)) {
      return NextResponse.json({ error: 'Invalid default vendor setting' }, { status: 400 })
    }
    
    // Save settings to Firestore using Admin SDK
    if (!db) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 })
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
    
    return NextResponse.json({ success: true, settings: settingsData })
  } catch (error) {
    console.error('Error saving user settings:', error)
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }
}

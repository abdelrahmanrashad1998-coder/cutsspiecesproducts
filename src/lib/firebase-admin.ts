import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

// Initialize Firebase Admin SDK
let app: any = null

try {
  // Check if Firebase Admin is already initialized
  if (getApps().length === 0) {
    // Check if required environment variables are set
    if (!process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
      console.warn('FIREBASE_ADMIN_PRIVATE_KEY environment variable not set. Firebase Admin SDK will not be initialized.')
    } else {
      let privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY
      
      // Handle base64 encoded private key
      if (process.env.FIREBASE_ADMIN_PRIVATE_KEY_BASE64) {
        const keyData = JSON.parse(Buffer.from(process.env.FIREBASE_ADMIN_PRIVATE_KEY_BASE64, 'base64').toString())
        privateKey = keyData.private_key
      } else {
        // Handle escaped newlines in environment variable
        privateKey = privateKey?.replace(/\\n/g, '\n')
      }
      
      const firebaseAdminConfig = {
        credential: cert({
          projectId: "shopify-product-add",
          clientEmail: "firebase-adminsdk-fbsvc@shopify-product-add.iam.gserviceaccount.com",
          privateKey: privateKey,
        }),
      }
      
      app = initializeApp(firebaseAdminConfig)
    }
  } else {
    app = getApps()[0]
  }
} catch (error) {
  console.error('Failed to initialize Firebase Admin SDK:', error)
  
  // Provide more specific error information
  if (error instanceof Error) {
    if (error.message.includes('DECODER routines::unsupported')) {
      console.error('SSL/TLS certificate issue detected. Check your FIREBASE_ADMIN_PRIVATE_KEY format.')
      console.error('Make sure the private key has proper newline characters, not escaped \\n strings.')
    } else if (error.message.includes('Invalid key format')) {
      console.error('Private key format is invalid. Check your FIREBASE_ADMIN_PRIVATE_KEY.')
    }
  }
}

// Export the services with error handling
export const auth = app ? getAuth(app) : null
export const db = app ? getFirestore(app) : null

export default app

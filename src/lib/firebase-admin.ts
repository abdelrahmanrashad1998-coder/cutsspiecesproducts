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
      const firebaseAdminConfig = {
        credential: cert({
          projectId: "shopify-product-add",
          clientEmail: "firebase-adminsdk-fbsvc@shopify-product-add.iam.gserviceaccount.com",
          privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      }
      
      app = initializeApp(firebaseAdminConfig)
    }
  } else {
    app = getApps()[0]
  }
} catch (error) {
  console.error('Failed to initialize Firebase Admin SDK:', error)
}

// Export the services with error handling
export const auth = app ? getAuth(app) : null
export const db = app ? getFirestore(app) : null

export default app

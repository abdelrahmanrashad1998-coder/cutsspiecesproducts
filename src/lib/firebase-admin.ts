import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

// Initialize Firebase Admin SDK
let app: any = null

try {
  // Check if Firebase Admin is already initialized
  if (getApps().length === 0) {
    console.log('Initializing Firebase Admin SDK...')
    
    // Check if required environment variables are set
    if (!process.env.FIREBASE_ADMIN_PRIVATE_KEY && !process.env.FIREBASE_ADMIN_PRIVATE_KEY_BASE64) {
      console.error('FIREBASE_ADMIN_PRIVATE_KEY or FIREBASE_ADMIN_PRIVATE_KEY_BASE64 environment variable not set. Firebase Admin SDK will not be initialized.')
      console.error('Available environment variables:', Object.keys(process.env).filter(key => key.includes('FIREBASE')))
    } else {
      let privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY
      
      // Handle base64 encoded private key
      if (process.env.FIREBASE_ADMIN_PRIVATE_KEY_BASE64) {
        console.log('Using base64 encoded private key')
        try {
          const keyData = JSON.parse(Buffer.from(process.env.FIREBASE_ADMIN_PRIVATE_KEY_BASE64, 'base64').toString())
          privateKey = keyData.private_key
          console.log('Successfully decoded base64 private key')
        } catch (decodeError) {
          console.error('Failed to decode base64 private key:', decodeError)
          throw new Error('Invalid base64 private key format')
        }
      } else {
        // Handle escaped newlines in environment variable
        privateKey = privateKey?.replace(/\\n/g, '\n')
        console.log('Using direct private key (length:', privateKey?.length, ')')
        
        // Additional validation and formatting for deployment environments
        if (privateKey && !privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
          console.warn('Private key may not be properly formatted. Expected to contain "-----BEGIN PRIVATE KEY-----"')
        }
        
        // Ensure proper key format for deployment
        if (privateKey && !privateKey.endsWith('\n')) {
          privateKey = privateKey + '\n'
          console.log('Added trailing newline to private key')
        }
      }
      
      // Create a more robust credential configuration
      // Use environment variables if available, fallback to hardcoded values
      const projectId = process.env.FIREBASE_PROJECT_ID || "shopify-product-add"
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || "firebase-adminsdk-fbsvc@shopify-product-add.iam.gserviceaccount.com"
      
      const credentialConfig = {
        projectId: projectId,
        clientEmail: clientEmail,
        privateKey: privateKey,
      }
      
      console.log('Credential config created with projectId:', credentialConfig.projectId)
      console.log('Client email:', credentialConfig.clientEmail)
      console.log('Private key starts with:', privateKey?.substring(0, 50) + '...')
      
      const firebaseAdminConfig = {
        credential: cert(credentialConfig),
      }
      
      console.log('Firebase Admin config created, initializing app...')
      
      try {
        app = initializeApp(firebaseAdminConfig)
        console.log('Firebase Admin SDK initialized successfully')
      } catch (initError: any) {
        console.error('Initial Firebase Admin initialization failed:', initError.message)
        
        // Try alternative initialization with different key formatting
        if (initError.message.includes('DECODER routines::unsupported')) {
          console.log('Attempting alternative private key formatting...')
          
          // Try with different newline handling
          const alternativePrivateKey = privateKey
            ?.replace(/\\n/g, '\n')
            ?.replace(/\r\n/g, '\n')
            ?.replace(/\r/g, '\n')
          
          if (alternativePrivateKey !== privateKey) {
            console.log('Trying with reformatted private key...')
            const alternativeConfig = {
              credential: cert({
                projectId: projectId,
                clientEmail: clientEmail,
                privateKey: alternativePrivateKey,
              }),
            }
            
            try {
              app = initializeApp(alternativeConfig)
              console.log('Firebase Admin SDK initialized successfully with alternative formatting')
            } catch (altError) {
              console.error('Alternative initialization also failed:', altError)
              throw initError // Throw original error
            }
          } else {
            throw initError
          }
        } else {
          throw initError
        }
      }
    }
  } else {
    app = getApps()[0]
    console.log('Firebase Admin SDK already initialized')
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
  
  // Set app to null to ensure services are also null
  app = null
}

// Export the services with error handling
export const auth = app ? getAuth(app) : null
export const db = app ? getFirestore(app) : null

// Add a helper function to check if Firebase is properly initialized
export function isFirebaseInitialized(): boolean {
  return app !== null && auth !== null && db !== null
}

export default app

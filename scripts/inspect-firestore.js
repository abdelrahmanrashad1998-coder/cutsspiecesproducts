const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Initialize Firebase Admin
const serviceAccount = {
  "type": "service_account",
  "project_id": process.env.FIREBASE_PROJECT_ID,
  "private_key_id": process.env.FIREBASE_PRIVATE_KEY_ID,
  "private_key": process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  "client_email": process.env.FIREBASE_CLIENT_EMAIL,
  "client_id": process.env.FIREBASE_CLIENT_ID,
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": process.env.FIREBASE_CLIENT_X509_CERT_URL
};

async function inspectFirestore() {
  try {
    console.log('Initializing Firebase Admin...');
    
    const app = initializeApp({
      credential: cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID
    });
    
    const db = getFirestore(app);
    console.log('Firebase Admin initialized successfully');
    
    // Get all shops
    console.log('\n=== FETCHING ALL SHOPS ===');
    const shopsSnapshot = await db.collection('shops').limit(10).get();
    
    if (shopsSnapshot.empty) {
      console.log('No shops found in the database');
      return;
    }
    
    console.log(`Found ${shopsSnapshot.docs.length} shops:`);
    
    shopsSnapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      console.log(`\nShop ${index + 1}:`);
      console.log(`  Document ID: ${doc.id}`);
      console.log(`  User ID: ${data.userId}`);
      console.log(`  Shopify Domain: ${data.shopifyDomain}`);
      console.log(`  Shop Name: ${data.shopName || 'N/A'}`);
      console.log(`  Is Active: ${data.isActive}`);
      console.log(`  Created At: ${data.createdAt?.toDate?.() || data.createdAt}`);
      console.log(`  Has Access Token: ${!!data.shopifyAccessToken}`);
      console.log(`  All Fields: ${Object.keys(data).join(', ')}`);
    });
    
    // Test specific shop lookup
    console.log('\n=== TESTING SPECIFIC SHOP LOOKUP ===');
    const testShopId = 'shop_1759857833785_y303npik6';
    console.log(`Testing lookup for shop ID: ${testShopId}`);
    
    // Direct document lookup
    const directDoc = await db.collection('shops').doc(testShopId).get();
    console.log(`\nDirect document lookup: ${directDoc.exists ? 'FOUND' : 'NOT FOUND'}`);
    if (directDoc.exists) {
      const data = directDoc.data();
      console.log(`  User ID: ${data.userId}`);
      console.log(`  Shopify Domain: ${data.shopifyDomain}`);
      console.log(`  Shop Name: ${data.shopName || 'N/A'}`);
    }
    
    // Query by domain (if the shopId looks like a domain)
    if (testShopId.includes('.myshopify.com')) {
      console.log('\nTesting domain query...');
      const domainQuery = await db.collection('shops').where('shopifyDomain', '==', testShopId).get();
      console.log(`Domain query results: ${domainQuery.docs.length} shops found`);
      domainQuery.docs.forEach((doc, index) => {
        const data = doc.data();
        console.log(`  ${index + 1}. Doc ID: ${doc.id}, User: ${data.userId}, Domain: ${data.shopifyDomain}`);
      });
    }
    
  } catch (error) {
    console.error('Error inspecting Firestore:', error);
  }
}

// Run the inspection
inspectFirestore().then(() => {
  console.log('\nInspection complete');
  process.exit(0);
}).catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});

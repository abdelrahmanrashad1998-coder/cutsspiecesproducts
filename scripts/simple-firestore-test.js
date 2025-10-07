// Simple test to check Firebase connection using the existing setup
require('dotenv').config({ path: '../.env.local' });

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

async function testFirestore() {
  try {
    console.log('Testing Firebase connection...');
    console.log('Project ID:', process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
    
    // Initialize Firebase Admin
    const serviceAccount = {
      "type": "service_account",
      "project_id": process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      "private_key": process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      "client_email": "firebase-adminsdk-fbsvc@shopify-product-add.iam.gserviceaccount.com"
    };
    
    const app = initializeApp({
      credential: cert(serviceAccount),
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
    });
    
    const db = getFirestore(app);
    console.log('Firebase Admin initialized successfully');
    
    console.log('Firebase Admin initialized successfully');
    
    // Get all shops
    console.log('\n=== FETCHING ALL SHOPS ===');
    const shopsSnapshot = await db.collection('shops').limit(5).get();
    
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
      console.log(`  All Fields: ${Object.keys(data).join(', ')}`);
    });
    
    // Test the specific shop ID that's failing
    console.log('\n=== TESTING FAILING SHOP ID ===');
    const failingShopId = 'shop_1759857833785_y303npik6';
    console.log(`Testing shop ID: ${failingShopId}`);
    
    const directDoc = await db.collection('shops').doc(failingShopId).get();
    console.log(`Direct lookup result: ${directDoc.exists ? 'EXISTS' : 'NOT FOUND'}`);
    
    if (directDoc.exists) {
      const data = directDoc.data();
      console.log(`  User ID: ${data.userId}`);
      console.log(`  Shopify Domain: ${data.shopifyDomain}`);
      console.log(`  Shop Name: ${data.shopName || 'N/A'}`);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testFirestore();

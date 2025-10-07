#!/usr/bin/env node

/**
 * Script to help fix Firebase Admin private key format for deployment
 * 
 * This script helps convert your Firebase service account private key
 * to the correct format for deployment environments like Vercel.
 */

const fs = require('fs');
const path = require('path');

function fixPrivateKeyFormat() {
  console.log('🔧 Firebase Private Key Format Fixer');
  console.log('=====================================\n');

  // Check if we have a service account key file
  const possiblePaths = [
    './firebase-service-account.json',
    './service-account-key.json',
    './firebase-adminsdk.json',
    './.env.local'
  ];

  let keyFile = null;
  for (const filePath of possiblePaths) {
    if (fs.existsSync(filePath)) {
      keyFile = filePath;
      break;
    }
  }

  if (!keyFile) {
    console.log('❌ No Firebase service account key file found.');
    console.log('Please place your Firebase service account JSON file in one of these locations:');
    possiblePaths.forEach(path => console.log(`   - ${path}`));
    console.log('\nOr manually set the FIREBASE_ADMIN_PRIVATE_KEY environment variable.');
    return;
  }

  console.log(`📁 Found key file: ${keyFile}`);

  try {
    if (keyFile.endsWith('.json')) {
      // Handle JSON service account file
      const serviceAccount = JSON.parse(fs.readFileSync(keyFile, 'utf8'));
      
      console.log('\n🔑 Service Account Details:');
      console.log(`   Project ID: ${serviceAccount.project_id}`);
      console.log(`   Client Email: ${serviceAccount.client_email}`);
      console.log(`   Private Key ID: ${serviceAccount.private_key_id}`);
      
      const privateKey = serviceAccount.private_key;
      
      console.log('\n📝 Environment Variables for Deployment:');
      console.log('Add these to your deployment platform (Vercel, Netlify, etc.):\n');
      
      console.log('FIREBASE_PROJECT_ID=' + serviceAccount.project_id);
      console.log('FIREBASE_CLIENT_EMAIL=' + serviceAccount.client_email);
      console.log('FIREBASE_ADMIN_PRIVATE_KEY=' + JSON.stringify(privateKey));
      
      console.log('\n⚠️  Important Notes:');
      console.log('1. The private key should be wrapped in quotes');
      console.log('2. Make sure newlines are preserved (not converted to \\n)');
      console.log('3. The key should start with "-----BEGIN PRIVATE KEY-----"');
      console.log('4. The key should end with "-----END PRIVATE KEY-----"');
      
      // Validate key format
      if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
        console.log('\n❌ WARNING: Private key format may be incorrect!');
        console.log('   Expected to contain "-----BEGIN PRIVATE KEY-----"');
      }
      
      if (!privateKey.includes('-----END PRIVATE KEY-----')) {
        console.log('\n❌ WARNING: Private key format may be incorrect!');
        console.log('   Expected to contain "-----END PRIVATE KEY-----"');
      }
      
    } else if (keyFile.endsWith('.env.local')) {
      // Handle .env.local file
      console.log('\n📝 Found .env.local file');
      console.log('Please ensure your FIREBASE_ADMIN_PRIVATE_KEY is properly formatted.');
      console.log('The key should have actual newlines, not \\n escape sequences.');
    }
    
  } catch (error) {
    console.error('❌ Error reading key file:', error.message);
  }
}

// Alternative: Base64 encoding approach
function generateBase64Key() {
  console.log('\n🔄 Alternative: Base64 Encoding Approach');
  console.log('==========================================\n');
  
  console.log('If the direct private key approach doesn\'t work, try base64 encoding:');
  console.log('1. Take your entire service account JSON file');
  console.log('2. Encode it to base64');
  console.log('3. Set FIREBASE_ADMIN_PRIVATE_KEY_BASE64 environment variable');
  console.log('\nExample:');
  console.log('FIREBASE_ADMIN_PRIVATE_KEY_BASE64=$(base64 -i firebase-service-account.json)');
}

// Run the script
if (require.main === module) {
  fixPrivateKeyFormat();
  generateBase64Key();
  
  console.log('\n✅ Next Steps:');
  console.log('1. Deploy your updated code');
  console.log('2. Set the environment variables in your deployment platform');
  console.log('3. Test the /api/debug/firebase endpoint');
  console.log('4. Check your deployment logs for Firebase initialization messages');
}

module.exports = { fixPrivateKeyFormat, generateBase64Key };

# Setup Guide - Environment Variables

## Quick Setup

You need to create a `.env.local` file in the project root with your Firebase credentials.

### Step 1: Create .env.local file

In the project root directory, create a file named `.env.local`:

```bash
touch .env.local
```

### Step 2: Add Firebase Configuration

Open `.env.local` and add the following variables:

```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Firebase Admin SDK
FIREBASE_ADMIN_PROJECT_ID=your_project_id
FIREBASE_ADMIN_CLIENT_EMAIL=your_service_account_email
FIREBASE_ADMIN_PRIVATE_KEY="your_private_key_here"

# OpenAI API Key (optional)
OPENAI_API_KEY=your_openai_key_here

# Database URL
DATABASE_URL="file:./dev.db"

# Next.js Base URL
NEXT_PUBLIC_BASE_URL=http://localhost:3001
```

### Step 3: Get Your Firebase Credentials

#### For Firebase Web Config (NEXT_PUBLIC_* variables):

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (or create a new one)
3. Click on **Project Settings** (gear icon)
4. Scroll down to **Your apps** section
5. If you don't have a web app, click **Add app** > **Web** (</>) 
6. Copy the `firebaseConfig` values:
   ```javascript
   const firebaseConfig = {
     apiKey: "...",           // → NEXT_PUBLIC_FIREBASE_API_KEY
     authDomain: "...",       // → NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
     projectId: "...",        // → NEXT_PUBLIC_FIREBASE_PROJECT_ID
     storageBucket: "...",    // → NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
     messagingSenderId: "...", // → NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
     appId: "..."             // → NEXT_PUBLIC_FIREBASE_APP_ID
   };
   ```

#### For Firebase Admin SDK:

1. In Firebase Console, go to **Project Settings**
2. Click on **Service Accounts** tab
3. Click **Generate new private key**
4. Download the JSON file
5. Open the JSON file and copy:
   - `project_id` → `FIREBASE_ADMIN_PROJECT_ID`
   - `client_email` → `FIREBASE_ADMIN_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_ADMIN_PRIVATE_KEY` (keep the quotes and \n characters)

#### For OpenAI API Key (Optional):

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Navigate to API Keys
3. Create a new secret key
4. Copy and paste into `OPENAI_API_KEY`

### Step 4: Enable Firebase Services

In your Firebase Console, make sure these services are enabled:

1. **Authentication**
   - Go to **Authentication** > **Sign-in method**
   - Enable **Email/Password**
   - Enable **Google** (optional)

2. **Firestore Database**
   - Go to **Firestore Database**
   - Click **Create database**
   - Start in **test mode** for development
   - Choose your region

3. **Storage** (for product images)
   - Go to **Storage**
   - Click **Get started**
   - Start in **test mode**

### Step 5: Set Firestore Security Rules

In Firestore Database > Rules, paste:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Subscriptions collection
    match /subscriptions/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Usage logs collection
    match /usageLogs/{logId} {
      allow read, write: if request.auth != null;
    }
    
    // Shops collection
    match /shops/{shopId} {
      allow read, write: if request.auth != null;
    }
    
    // User settings collection
    match /userSettings/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### Step 6: Restart the Development Server

After creating `.env.local`:

```bash
# Stop the current server (Ctrl+C)
# Then restart:
npm run dev
```

## Verification

To verify everything is set up correctly:

1. Visit `http://localhost:3001` (or whatever port is shown)
2. You should see the login page without errors
3. Try creating a new account
4. Check if you're redirected to the dashboard
5. Verify your subscription shows as "Free Trial"

## Troubleshooting

### Error: "Missing Firebase configuration"
- Make sure `.env.local` file exists in the root directory
- Check that all variables start with `NEXT_PUBLIC_` for client-side variables
- Restart the dev server after creating/editing `.env.local`

### Error: "Firebase: Error (auth/...)"
- Check that Authentication is enabled in Firebase Console
- Verify your API key is correct
- Make sure your domain is authorized in Firebase Console

### Error: "Permission denied" in Firestore
- Update your Firestore security rules as shown above
- Rules should allow authenticated users to access their own data

## Need Help?

If you encounter issues:
1. Check the browser console for detailed error messages
2. Verify all Firebase services are enabled
3. Make sure `.env.local` has all required variables
4. Ensure there are no extra spaces or quotes around values (except for PRIVATE_KEY)

## Example .env.local (with fake values)

```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyABC123DEF456GHI789JKL012MNO345PQR
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=my-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=my-project-12345
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=my-project-12345.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abc123def456ghi789

FIREBASE_ADMIN_PROJECT_ID=my-project-12345
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-abc12@my-project-12345.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgk...\n-----END PRIVATE KEY-----\n"

OPENAI_API_KEY=sk-proj-abcdefghijklmnopqrstuvwxyz1234567890

DATABASE_URL="file:./dev.db"
NEXT_PUBLIC_BASE_URL=http://localhost:3001
```



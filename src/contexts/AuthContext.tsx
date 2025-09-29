'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { 
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'

interface User {
  id: string
  firebaseUid: string
  email: string
  name?: string
  avatar?: string
}

export interface Shop {
  id: string
  shopifyDomain: string
  shopName?: string
  shopEmail?: string
  storeDescription?: string
  currency?: string
  isActive: boolean
  createdAt: Date
}

interface AuthContextType {
  user: User | null
  firebaseUser: FirebaseUser | null
  loading: boolean
  selectedShop: Shop | null
  setSelectedShop: (shop: Shop | null) => void
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, name?: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedShop, setSelectedShopState] = useState<Shop | null>(null)

  // Load selected shop from localStorage on mount
  useEffect(() => {
    const savedShop = localStorage.getItem('selectedShop')
    if (savedShop) {
      try {
        const parsedShop = JSON.parse(savedShop)
        // Convert createdAt back to Date object
        parsedShop.createdAt = new Date(parsedShop.createdAt)
        setSelectedShopState(parsedShop)
      } catch (error) {
        console.error('Error parsing saved shop:', error)
        localStorage.removeItem('selectedShop')
      }
    }
  }, [])

  // Function to set selected shop and persist to localStorage
  const setSelectedShop = (shop: Shop | null) => {
    setSelectedShopState(shop)
    if (shop) {
      localStorage.setItem('selectedShop', JSON.stringify(shop))
    } else {
      localStorage.removeItem('selectedShop')
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setFirebaseUser(firebaseUser)
      
      if (firebaseUser) {
        try {
          // Get or create user in Firestore
          const userRef = doc(db, 'users', firebaseUser.uid)
          const userSnap = await getDoc(userRef)
          
          if (userSnap.exists()) {
            const userData = userSnap.data()
            setUser({
              id: firebaseUser.uid,
              firebaseUid: firebaseUser.uid,
              email: userData.email,
              name: userData.name,
              avatar: userData.avatar,
            })
          } else {
            // Create new user document
            const newUser = {
              firebaseUid: firebaseUser.uid,
              email: firebaseUser.email,
              name: firebaseUser.displayName,
              avatar: firebaseUser.photoURL,
              createdAt: new Date(),
              updatedAt: new Date(),
            }
            
            await setDoc(userRef, newUser)
            setUser({
              id: firebaseUser.uid,
              firebaseUid: firebaseUser.uid,
              email: firebaseUser.email || '',
              name: firebaseUser.displayName || undefined,
              avatar: firebaseUser.photoURL || undefined,
            })
          }
        } catch (error: any) {
          console.error('Error managing user data:', error)
          
          // If it's a permission error, show helpful message
          if (error.code === 'permission-denied') {
            console.error('🚨 FIRESTORE RULES NOT DEPLOYED! Please deploy security rules in Firebase Console.')
          }
          
          // Set user anyway to prevent blocking the app
          setUser({
            id: firebaseUser.uid,
            firebaseUid: firebaseUser.uid,
            email: firebaseUser.email || '',
            name: firebaseUser.displayName || undefined,
            avatar: firebaseUser.photoURL || undefined,
          })
        }
      } else {
        setUser(null)
      }
      
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password)
  }

  const signUp = async (email: string, password: string, name?: string) => {
    await createUserWithEmailAndPassword(auth, email, password)
  }

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider()
    await signInWithPopup(auth, provider)
  }

  const logout = async () => {
    await signOut(auth)
    // Clear selected shop on logout
    setSelectedShop(null)
  }

  const value = {
    user,
    firebaseUser,
    loading,
    selectedShop,
    setSelectedShop,
    signIn,
    signUp,
    signInWithGoogle,
    logout,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

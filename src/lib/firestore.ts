import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  getDocs, 
  query, 
  where, 
  deleteDoc,
  updateDoc 
} from 'firebase/firestore'
import { db } from './firebase'
import { db as adminDb } from './firebase-admin'

export interface ShopData {
  id: string
  userId: string
  shopifyDomain: string
  shopifyApiKey?: string
  shopifyApiSecret?: string
  shopifyAccessToken: string
  shopName?: string
  shopEmail?: string
  storeDescription?: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface ProductData {
  id: string
  userId: string
  shopId: string
  shopifyId: string
  title: string
  description?: string
  price: number
  category?: string
  images: string[]
  variants: any[]
  createdAt: Date
  updatedAt: Date
}

// Shop operations
export async function createShop(shopData: Omit<ShopData, 'id' | 'createdAt' | 'updatedAt'>): Promise<ShopData> {
  const shopId = `shop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const now = new Date()
  
  const newShop: ShopData = {
    id: shopId,
    ...shopData,
    isActive: true,
    createdAt: now,
    updatedAt: now
  }

  await setDoc(doc(db, 'shops', shopId), newShop)
  return newShop
}

export async function getShopsByUserId(userId: string): Promise<ShopData[]> {
  const shopsRef = collection(db, 'shops')
  const q = query(shopsRef, where('userId', '==', userId))
  const querySnapshot = await getDocs(q)
  
  return querySnapshot.docs.map(doc => doc.data() as ShopData)
}

export async function getShopById(shopId: string): Promise<ShopData | null> {
  const shopRef = doc(db, 'shops', shopId)
  const shopSnap = await getDoc(shopRef)
  
  if (shopSnap.exists()) {
    return shopSnap.data() as ShopData
  }
  return null
}

export async function updateShop(shopId: string, updates: Partial<ShopData>): Promise<void> {
  const shopRef = doc(db, 'shops', shopId)
  await updateDoc(shopRef, {
    ...updates,
    updatedAt: new Date()
  })
}

export async function deleteShop(shopId: string): Promise<void> {
  const shopRef = doc(db, 'shops', shopId)
  await deleteDoc(shopRef)
}

// Product operations
export async function createProduct(productData: Omit<ProductData, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProductData> {
  const productId = `product_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const now = new Date()
  
  const newProduct: ProductData = {
    id: productId,
    ...productData,
    createdAt: now,
    updatedAt: now
  }

  await setDoc(doc(db, 'products', productId), newProduct)
  return newProduct
}

export async function getProductsByUserId(userId: string): Promise<ProductData[]> {
  const productsRef = collection(db, 'products')
  const q = query(productsRef, where('userId', '==', userId))
  const querySnapshot = await getDocs(q)
  
  return querySnapshot.docs.map(doc => doc.data() as ProductData)
}

export async function getProductsByShopId(shopId: string): Promise<ProductData[]> {
  const productsRef = collection(db, 'products')
  const q = query(productsRef, where('shopId', '==', shopId))
  const querySnapshot = await getDocs(q)
  
  return querySnapshot.docs.map(doc => doc.data() as ProductData)
}

export async function updateProduct(productId: string, updates: Partial<ProductData>): Promise<void> {
  const productRef = doc(db, 'products', productId)
  await updateDoc(productRef, {
    ...updates,
    updatedAt: new Date()
  })
}

export async function deleteProduct(productId: string): Promise<void> {
  const productRef = doc(db, 'products', productId)
  await deleteDoc(productRef)
}

import { db } from './firebase-admin'

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
  currency?: string
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

// Server-side shop operations using Admin SDK
export async function createShopAdmin(shopData: Omit<ShopData, 'id' | 'createdAt' | 'updatedAt'>): Promise<ShopData> {
  const shopId = `shop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const now = new Date()
  
  const newShop: ShopData = {
    id: shopId,
    ...shopData,
    isActive: true,
    createdAt: now,
    updatedAt: now
  }

  await db.collection('shops').doc(shopId).set(newShop)
  return newShop
}

export async function getShopsByUserIdAdmin(userId: string): Promise<ShopData[]> {
  const shopsSnapshot = await db.collection('shops').where('userId', '==', userId).get()
  
  return shopsSnapshot.docs.map(doc => doc.data() as ShopData)
}

export async function getShopByIdAdmin(shopId: string): Promise<ShopData | null> {
  const shopDoc = await db.collection('shops').doc(shopId).get()
  
  if (shopDoc.exists) {
    return shopDoc.data() as ShopData
  }
  return null
}

export async function updateShopAdmin(shopId: string, updates: Partial<ShopData>): Promise<void> {
  await db.collection('shops').doc(shopId).update({
    ...updates,
    updatedAt: new Date()
  })
}

export async function deleteShopAdmin(shopId: string): Promise<void> {
  await db.collection('shops').doc(shopId).delete()
}

// Server-side product operations using Admin SDK
export async function createProductAdmin(productData: Omit<ProductData, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProductData> {
  const productId = `product_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const now = new Date()
  
  const newProduct: ProductData = {
    id: productId,
    ...productData,
    createdAt: now,
    updatedAt: now
  }

  await db.collection('products').doc(productId).set(newProduct)
  return newProduct
}

export async function getProductsByUserIdAdmin(userId: string): Promise<ProductData[]> {
  const productsSnapshot = await db.collection('products').where('userId', '==', userId).get()
  
  return productsSnapshot.docs.map(doc => doc.data() as ProductData)
}

export async function getProductsByShopIdAdmin(shopId: string): Promise<ProductData[]> {
  const productsSnapshot = await db.collection('products').where('shopId', '==', shopId).get()
  
  return productsSnapshot.docs.map(doc => doc.data() as ProductData)
}

export async function updateProductAdmin(productId: string, updates: Partial<ProductData>): Promise<void> {
  await db.collection('products').doc(productId).update({
    ...updates,
    updatedAt: new Date()
  })
}

export async function deleteProductAdmin(productId: string): Promise<void> {
  await db.collection('products').doc(productId).delete()
}

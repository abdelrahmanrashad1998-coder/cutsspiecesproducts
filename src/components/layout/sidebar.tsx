'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { 
  LayoutDashboard, 
  Plus, 
  Settings, 
  LogOut,
  Package,
  Store,
  User,
  Crown
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Add Product', href: '/add-product', icon: Plus },
  { name: 'Manage Shops', href: '/connect-shop', icon: Store },
  { name: 'Pricing & Plans', href: '/pricing', icon: Crown },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuth()

  const handleLogout = async () => {
    try {
      await logout()
      window.location.href = '/login'
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  return (
    <div className="flex h-full w-64 flex-col bg-gray-900">
      <div className="flex h-16 items-center px-4">
        <div className="flex items-center space-x-2">
          <Package className="h-8 w-8 text-white" />
          <span className="text-xl font-bold text-white">Shopify AI</span>
        </div>
      </div>
      
      {/* User Info */}
      {user && (
        <div className="px-4 py-3 border-b border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              {user.avatar ? (
                <img
                  className="h-8 w-8 rounded-full"
                  src={user.avatar}
                  alt={user.name || user.email}
                />
              ) : (
                <div className="h-8 w-8 rounded-full bg-gray-600 flex items-center justify-center">
                  <User className="h-4 w-4 text-white" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {user.name || 'User'}
              </p>
              <p className="text-xs text-gray-300 truncate">
                {user.email}
              </p>
            </div>
          </div>
        </div>
      )}
      
      <nav className="flex-1 space-y-1 px-2 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors',
                isActive
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              )}
            >
              <item.icon
                className={cn(
                  'mr-3 h-5 w-5 flex-shrink-0',
                  isActive ? 'text-white' : 'text-gray-400 group-hover:text-white'
                )}
              />
              {item.name}
            </Link>
          )
        })}
      </nav>
      
      <div className="p-4">
        <Button
          onClick={handleLogout}
          variant="ghost"
          className="w-full justify-start text-gray-300 hover:bg-gray-700 hover:text-white"
        >
          <LogOut className="mr-3 h-5 w-5" />
          Sign out
        </Button>
      </div>
    </div>
  )
}

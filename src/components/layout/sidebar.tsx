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
  Crown,
  Sparkles
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

interface SidebarProps {
  onClose?: () => void
}

export function Sidebar({ onClose }: SidebarProps = {}) {
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
    <div className="flex h-full w-64 flex-col bg-[#245468]">
      {/* Brand Header */}
      <div className="flex h-20 items-center px-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-[#fc8a2c] blur-lg opacity-50 rounded-full"></div>
            <Sparkles className="relative h-8 w-8 text-[#fc8a2c]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Rable</h1>
            <p className="text-xs text-[#fc8a2c] font-medium">Shopify AI</p>
          </div>
        </div>
      </div>
      
      {/* User Info */}
      {user && (
        <div className="px-4 py-4 border-b border-white/10">
          <div className="flex items-center gap-3 bg-white/5 rounded-lg p-3 hover:bg-white/10 transition-colors">
            <div className="flex-shrink-0">
              {user.avatar ? (
                <img
                  className="h-10 w-10 rounded-full ring-2 ring-[#fc8a2c]"
                  src={user.avatar}
                  alt={user.name || user.email}
                />
              ) : (
                <div className="h-10 w-10 rounded-full bg-[#fc8a2c] flex items-center justify-center ring-2 ring-[#fc8a2c]/30">
                  <User className="h-5 w-5 text-white" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {user.name || 'User'}
              </p>
              <p className="text-xs text-white/70 truncate">
                {user.email}
              </p>
            </div>
          </div>
        </div>
      )}
      
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onClose}
              className={cn(
                'group flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200',
                isActive
                  ? 'bg-[#fc8a2c] text-white shadow-lg shadow-[#fc8a2c]/20'
                  : 'text-white/80 hover:bg-white/10 hover:text-white'
              )}
            >
              <item.icon
                className={cn(
                  'mr-3 h-5 w-5 flex-shrink-0 transition-transform duration-200',
                  isActive ? 'text-white scale-110' : 'text-white/60 group-hover:text-white group-hover:scale-105'
                )}
              />
              {item.name}
            </Link>
          )
        })}
      </nav>
      
      <div className="p-4 border-t border-white/10">
        <Button
          onClick={handleLogout}
          variant="ghost"
          className="w-full justify-start text-white/80 hover:bg-white/10 hover:text-white transition-all duration-200"
        >
          <LogOut className="mr-3 h-5 w-5" />
          Sign out
        </Button>
      </div>
    </div>
  )
}

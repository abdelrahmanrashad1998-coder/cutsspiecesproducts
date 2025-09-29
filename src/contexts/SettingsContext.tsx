'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext'

export interface UserSettings {
  openaiApiKey?: string
  openaiModel?: string
  updatedAt: Date
}

interface SettingsContextType {
  settings: UserSettings
  loading: boolean
  updateSettings: (newSettings: Partial<UserSettings>) => Promise<void>
  refreshSettings: () => Promise<void>
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<UserSettings>({
    openaiApiKey: '',
    openaiModel: 'gpt-4o',
    updatedAt: new Date()
  })
  const [loading, setLoading] = useState(true)
  const { user, firebaseUser } = useAuth()

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('userSettings')
    if (savedSettings) {
      try {
        const parsedSettings = JSON.parse(savedSettings)
        // Convert updatedAt back to Date object
        parsedSettings.updatedAt = new Date(parsedSettings.updatedAt)
        setSettings(parsedSettings)
      } catch (error) {
        console.error('Error parsing saved settings:', error)
        localStorage.removeItem('userSettings')
      }
    }
    setLoading(false)
  }, [])

  // Load settings from server when user is authenticated
  useEffect(() => {
    if (firebaseUser) {
      refreshSettings()
    }
  }, [firebaseUser])

  const refreshSettings = async () => {
    if (!firebaseUser) return

    try {
      const token = await firebaseUser.getIdToken()
      console.log('Fetching settings for user:', firebaseUser.uid)
      
      const response = await fetch('/api/user/settings', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const serverSettings = await response.json()
        console.log('Settings loaded from server:', serverSettings)
        setSettings(serverSettings)
        // Save to localStorage for offline access
        localStorage.setItem('userSettings', JSON.stringify(serverSettings))
      } else {
        const errorData = await response.json()
        console.error('Failed to fetch settings:', response.status, errorData)
      }
    } catch (error) {
      console.error('Error fetching settings from server:', error)
    }
  }

  const updateSettings = async (newSettings: Partial<UserSettings>) => {
    if (!firebaseUser) return

    try {
      const token = await firebaseUser.getIdToken()
      console.log('Saving settings for user:', firebaseUser.uid, newSettings)
      
      const response = await fetch('/api/user/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newSettings)
      })

      if (response.ok) {
        const updatedSettings = await response.json()
        console.log('Settings saved successfully:', updatedSettings)
        setSettings(updatedSettings.settings)
        // Save to localStorage for offline access
        localStorage.setItem('userSettings', JSON.stringify(updatedSettings.settings))
      } else {
        const errorData = await response.json()
        console.error('Failed to save settings:', response.status, errorData)
        throw new Error('Failed to update settings')
      }
    } catch (error) {
      console.error('Error updating settings:', error)
      throw error
    }
  }

  const value = {
    settings,
    loading,
    updateSettings,
    refreshSettings,
  }

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const context = useContext(SettingsContext)
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider')
  }
  return context
}

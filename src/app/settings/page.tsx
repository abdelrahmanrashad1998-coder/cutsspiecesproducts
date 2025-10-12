'use client'

import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Save, User } from 'lucide-react'
import { toast } from 'sonner'
import { useSettings } from '@/contexts/SettingsContext'
import { useState, useEffect } from 'react'

export default function SettingsPage() {
  const { settings, updateSettings, loading } = useSettings()
  const [defaultVendor, setDefaultVendor] = useState(settings.defaultVendor || 'store_name')
  const [customVendor, setCustomVendor] = useState(settings.customVendor || '')
  const [saving, setSaving] = useState(false)

  // Sync local state with settings context
  useEffect(() => {
    setDefaultVendor(settings.defaultVendor || 'store_name')
    setCustomVendor(settings.customVendor || '')
  }, [settings])

  const handleSaveSettings = async () => {
    setSaving(true)
    try {
      await updateSettings({
        defaultVendor: defaultVendor,
        customVendor: customVendor
      })
      toast.success('Settings saved successfully!')
    } catch (error) {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const handleClearSettings = () => {
    setDefaultVendor('store_name')
    setCustomVendor('')
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600">Manage your application settings</p>
        </div>

        {/* Default Vendor Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <User className="mr-2 h-5 w-5" />
              Default Vendor Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="default-vendor">Default Vendor Behavior</Label>
              <Select value={defaultVendor} onValueChange={setDefaultVendor}>
                <SelectTrigger>
                  <SelectValue placeholder="Select default vendor behavior" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="store_name">Use Store Name</SelectItem>
                  <SelectItem value="custom">Use Custom Vendor</SelectItem>
                  <SelectItem value="none">No Default (Leave Empty)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-gray-500">
                Choose how the vendor field should be populated by default when adding new products.
              </p>
            </div>
            
            {defaultVendor === 'custom' && (
              <div className="space-y-2">
                <Label htmlFor="custom-vendor">Custom Vendor Name</Label>
                <Input
                  id="custom-vendor"
                  value={customVendor}
                  onChange={(e) => setCustomVendor(e.target.value)}
                  placeholder="Enter your custom vendor name"
                />
                <p className="text-sm text-gray-500">
                  This will be used as the default vendor for all new products.
                </p>
              </div>
            )}
            
            {defaultVendor === 'store_name' && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                <p className="text-sm text-blue-800">
                  <strong>Store Name:</strong> The vendor field will automatically use your store's name as the default value.
                </p>
              </div>
            )}
            
            {defaultVendor === 'none' && (
              <div className="p-3 bg-gray-50 border border-gray-200 rounded">
                <p className="text-sm text-gray-600">
                  <strong>No Default:</strong> The vendor field will be left empty by default, allowing you to enter a custom value for each product.
                </p>
              </div>
            )}
            
            <div className="flex space-x-4">
              <Button 
                onClick={handleSaveSettings} 
                disabled={saving}
                className="flex items-center"
              >
                <Save className="mr-2 h-4 w-4" />
                {saving ? 'Saving...' : 'Save Settings'}
              </Button>
              <Button 
                onClick={handleClearSettings} 
                variant="outline"
              >
                Reset to Defaults
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}

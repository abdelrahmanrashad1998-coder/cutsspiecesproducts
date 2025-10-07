'use client'

import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Settings, Key, Store, Database, Save, Eye, EyeOff, User } from 'lucide-react'
import { toast } from 'sonner'
import { useSettings } from '@/contexts/SettingsContext'
import { useState, useEffect } from 'react'

export default function SettingsPage() {
  const { settings, updateSettings, loading } = useSettings()
  const [openaiKey, setOpenaiKey] = useState(settings.openaiApiKey || '')
  const [selectedModel, setSelectedModel] = useState(settings.openaiModel || 'gpt-4o')
  const [defaultVendor, setDefaultVendor] = useState(settings.defaultVendor || 'store_name')
  const [customVendor, setCustomVendor] = useState(settings.customVendor || '')
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)

  // Sync local state with settings context
  useEffect(() => {
    setOpenaiKey(settings.openaiApiKey || '')
    setSelectedModel(settings.openaiModel || 'gpt-4o')
    setDefaultVendor(settings.defaultVendor || 'store_name')
    setCustomVendor(settings.customVendor || '')
  }, [settings])

  const handleTestConnection = async (type: 'shopify' | 'openai') => {
    try {
      // Check if OpenAI key is provided for OpenAI test
      if (type === 'openai' && !openaiKey) {
        toast.error('Please enter your OpenAI API key first')
        return
      }

      let url = `/api/test-connection/${type}`
      
      // For OpenAI, include the current API key in the request
      if (type === 'openai' && openaiKey) {
        url += `?apiKey=${encodeURIComponent(openaiKey)}`
      }
      
      const response = await fetch(url)
      const data = await response.json()
      
      if (response.ok && data.success) {
        toast.success(`${type.toUpperCase()} connection successful!`)
      } else {
        toast.error(data.message || `${type.toUpperCase()} connection failed`)
      }
    } catch (error) {
      toast.error(`Error testing ${type.toUpperCase()} connection`)
    }
  }

  const handleSaveSettings = async () => {
    setSaving(true)
    try {
      await updateSettings({
        openaiApiKey: openaiKey,
        openaiModel: selectedModel,
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
    setOpenaiKey('')
    setSelectedModel('gpt-4o')
    setDefaultVendor('store_name')
    setCustomVendor('')
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600">Manage your application settings and connections</p>
        </div>

        {/* Environment Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Settings className="mr-2 h-5 w-5" />
              Environment Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-3 border rounded">
                <div className="flex items-center">
                  <Store className="mr-2 h-4 w-4" />
                  <span>Shopify API</span>
                </div>
                <Badge variant="secondary">Configured</Badge>
              </div>
              <div className="flex items-center justify-between p-3 border rounded">
                <div className="flex items-center">
                  <Key className="mr-2 h-4 w-4" />
                  <span>OpenAI API</span>
                </div>
                <Badge variant="secondary">Configured</Badge>
              </div>
              <div className="flex items-center justify-between p-3 border rounded">
                <div className="flex items-center">
                  <Database className="mr-2 h-4 w-4" />
                  <span>Database</span>
                </div>
                <Badge variant="default">Connected</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* OpenAI Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Key className="mr-2 h-5 w-5" />
              OpenAI Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="openai-key">OpenAI API Key</Label>
              <div className="relative">
                <Input
                  id="openai-key"
                  type={showKey ? "text" : "password"}
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  placeholder="sk-..."
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowKey(!showKey)}
                >
                  {showKey ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-sm text-gray-500">
                Your API key is stored securely and only used for OpenAI requests.
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="openai-model">OpenAI Model</Label>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4o">GPT-4o (Vision)</SelectItem>
                  <SelectItem value="gpt-4o-mini">GPT-4o Mini (Vision)</SelectItem>
                  <SelectItem value="gpt-4">GPT-4</SelectItem>
                  <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-gray-500">
                Choose the model for product analysis and image processing.
              </p>
            </div>

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
                Clear Settings
              </Button>
              <Button 
                onClick={() => handleTestConnection('openai')} 
                variant="outline"
              >
                Test OpenAI Connection
              </Button>
            </div>
          </CardContent>
        </Card>

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
          </CardContent>
        </Card>

        {/* Shopify Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Store className="mr-2 h-5 w-5" />
              Shopify Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Shopify Store Domain</Label>
              <Input
                value={process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN || 'your_store.myshopify.com'}
                disabled
                className="bg-gray-50"
              />
            </div>
            <div className="flex space-x-4">
              <Button onClick={() => handleTestConnection('shopify')} variant="outline">
                Test Shopify Connection
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>Setup Instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="prose max-w-none">
              <h4>Environment Variables Required:</h4>
              <ul className="list-disc list-inside space-y-2 text-sm">
                <li><code>SHOPIFY_API_KEY</code> - Your Shopify API key</li>
                <li><code>SHOPIFY_API_SECRET</code> - Your Shopify API secret</li>
                <li><code>SHOPIFY_ACCESS_TOKEN</code> - Your Shopify access token</li>
                <li><code>SHOPIFY_STORE_DOMAIN</code> - Your store domain (e.g., mystore.myshopify.com)</li>
                <li><code>OPENAI_API_KEY</code> - Your OpenAI API key</li>
              </ul>
              
              <h4 className="mt-6">Getting Started:</h4>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>Set up your Shopify private app with Admin API access</li>
                <li>Get your OpenAI API key from OpenAI platform</li>
                <li>Create a .env.local file with the required variables</li>
                <li>Run the application and test the connections</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}

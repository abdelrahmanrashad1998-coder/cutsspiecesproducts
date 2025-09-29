'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { 
  Search, 
  FolderOpen,
  Loader2,
  ExternalLink,
  Eye
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth, Shop } from '@/contexts/AuthContext'
import { diagnoseCollectionIssues, generateDiagnosticMessage } from '@/lib/collections-diagnostics'

interface Collection {
  id: number
  title: string
  body_html: string
  handle: string
  published_at: string | null
  sort_order: string
  template_suffix: string | null
  disjunctive: boolean
  rules: Array<{
    column: string
    relation: string
    condition: string
  }>
  published_scope: string
  admin_graphql_api_id: string
  image?: {
    id: number
    src: string
    alt: string | null
  }
  updated_at: string
  created_at: string
}

interface CollectionsDisplayProps {
  selectedShop: Shop | null
}

export function CollectionsDisplay({ selectedShop }: CollectionsDisplayProps) {
  const [collections, setCollections] = useState<Collection[]>([])
  const [filteredCollections, setFilteredCollections] = useState<Collection[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { firebaseUser } = useAuth()

  useEffect(() => {
    if (selectedShop) {
      fetchCollections()
    } else {
      setCollections([])
      setFilteredCollections([])
      setSearchTerm('')
      setError(null)
    }
  }, [selectedShop])

  useEffect(() => {
    const filtered = collections.filter(collection =>
      collection.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      collection.handle.toLowerCase().includes(searchTerm.toLowerCase())
    )
    setFilteredCollections(filtered)
  }, [collections, searchTerm])

  const fetchCollections = async () => {
    if (!selectedShop) {
      console.log('No shop selected')
      setError('No shop selected')
      return
    }

    setIsLoading(true)
    setError(null)
    
    try {
      if (!firebaseUser) {
        setError('Authentication required')
        toast.error('Please log in to view collections')
        return
      }

      const token = await firebaseUser.getIdToken()
      console.log('=== COLLECTIONS FETCH DEBUG ===')
      console.log('Fetching collections for shop:', selectedShop.id)
      console.log('Selected shop data:', selectedShop)
      console.log('Firebase user:', firebaseUser.uid)
      console.log('API URL:', `/api/shops/${selectedShop.id}/collections`)
      
      const response = await fetch(`/api/shops/${selectedShop.id}/collections`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      console.log('Collections API response status:', response.status)
      console.log('Collections API response headers:', Object.fromEntries(response.headers.entries()))

      if (response.ok) {
        const data = await response.json()
        console.log('Collections data received:', {
          hasCollections: !!data.collections,
          collectionsCount: data.collections?.length || 0,
          shopInfo: data.shop
        })
        
        const collectionsArray = data.collections || []
        setCollections(collectionsArray)
        
        if (collectionsArray.length === 0) {
          toast.info('No collections found in this shop')
        } else {
          toast.success(`Loaded ${collectionsArray.length} collections`)
        }
      } else {
        let errorMessage = 'Failed to fetch collections'
        let errorDetails = null
        
        // First, let's see the raw response text
        const responseText = await response.text()
        console.error('Collections API error - Raw response:', responseText)
        console.error('Response status:', response.status, response.statusText)
        
        try {
          const errorData = responseText ? JSON.parse(responseText) : {}
          console.error('Collections API error response:', {
            status: response.status,
            statusText: response.statusText,
            responseText,
            parsedErrorData: errorData,
            isObject: typeof errorData === 'object',
            isEmpty: Object.keys(errorData).length === 0
          })
          
          errorMessage = errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`
          errorDetails = errorData.details || errorData
          
          // Use diagnostic tool to provide better error messages
          const diagnostic = diagnoseCollectionIssues(
            response.status,
            errorMessage,
            selectedShop,
            errorDetails
          )
          
          if (diagnostic.issues.length > 0) {
            const primaryIssue = diagnostic.issues[0]
            errorMessage = `${primaryIssue.issue}: ${primaryIssue.solution}`
            
            // Show toast with actionable message
            if (primaryIssue.severity === 'high') {
              toast.error(`${primaryIssue.issue}: ${primaryIssue.solution}`)
            } else {
              toast.warning(`${primaryIssue.issue}: ${primaryIssue.solution}`)
            }
            
            // Log full diagnostic information
            console.error('Collection Diagnostic Results:', diagnostic)
            console.error('Full diagnostic message:', generateDiagnosticMessage(diagnostic))
          } else {
            toast.error(`Collections error: ${errorMessage}`)
          }
        } catch (parseError) {
          console.error('Failed to parse error response:', parseError)
          errorMessage = `HTTP ${response.status}: ${response.statusText}`
          toast.error(`Network error: ${errorMessage}`)
        }
        
        console.error('Final error message:', errorMessage)
        console.error('Final error details:', errorDetails)
        setError(errorMessage)
      }
    } catch (error: any) {
      console.error('Collections fetch error:', error)
      const errorMessage = error.message || 'Network error occurred'
      setError(errorMessage)
      toast.error(`Connection error: ${errorMessage}`)
    } finally {
      setIsLoading(false)
    }
  }

  const debugCollections = async () => {
    if (!selectedShop || !firebaseUser) return

    try {
      const token = await firebaseUser.getIdToken()
      console.log('Running debug for shop:', selectedShop.id)
      
      const response = await fetch('/api/debug-collections', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ shopId: selectedShop.id }),
      })

      const data = await response.json()
      console.log('Debug response:', data)
      
      if (response.ok) {
        toast.success('Debug info logged to console')
      } else {
        toast.error(`Debug failed: ${data.error}`)
      }
    } catch (error) {
      console.error('Debug error:', error)
      toast.error('Debug failed')
    }
  }

  const testAPI = async () => {
    try {
      console.log('Testing simple API endpoint...')
      
      // Test GET
      const getResponse = await fetch('/api/test-collections')
      const getData = await getResponse.json()
      console.log('Test API GET response:', getData)
      
      // Test POST
      const postResponse = await fetch('/api/test-collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'data', shopId: selectedShop?.id })
      })
      const postData = await postResponse.json()
      console.log('Test API POST response:', postData)
      
      toast.success('API test completed - check console')
    } catch (error) {
      console.error('API test error:', error)
      toast.error('API test failed')
    }
  }

  const runComprehensiveTest = async () => {
    if (!selectedShop || !firebaseUser) {
      toast.error('No shop selected or not authenticated')
      return
    }

    try {
      toast.loading('Running comprehensive collections test...')
      const token = await firebaseUser.getIdToken()
      
      const response = await fetch('/api/test-collections-comprehensive', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ shopId: selectedShop.id }),
      })

      const data = await response.json()
      console.log('=== COMPREHENSIVE TEST RESULTS ===', data)
      
      if (response.ok) {
        toast.success('Comprehensive test completed - check console for detailed results')
      } else {
        toast.error(`Test failed: ${data.error}`)
      }
    } catch (error) {
      console.error('Comprehensive test error:', error)
      toast.error('Comprehensive test failed')
    }
  }

  const testShopCredentials = async () => {
    if (!selectedShop || !firebaseUser) {
      toast.error('No shop selected or not authenticated')
      return
    }

    try {
      toast.loading('Testing shop credentials and domain...')
      const token = await firebaseUser.getIdToken()
      
      const response = await fetch('/api/direct-shopify-test', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ shopId: selectedShop.id }),
      })

      const data = await response.json()
      console.log('=== SHOP CREDENTIALS TEST RESULTS ===', data)
      
      if (response.ok) {
        const recommendations = data.testResults?.recommendations || []
        if (recommendations.length > 0) {
          console.log('Recommendations:', recommendations.join(', '))
          toast.success(`Credentials test completed - found ${recommendations.length} recommendations (check console)`)
        } else {
          toast.success('Credentials test completed - check console for results')
        }
      } else {
        toast.error(`Credentials test failed: ${data.error}`)
      }
    } catch (error) {
      console.error('Credentials test error:', error)
      toast.error('Credentials test failed')
    }
  }

  const fixShopDomain = async () => {
    if (!selectedShop || !firebaseUser) {
      toast.error('No shop selected or not authenticated')
      return
    }

    try {
      toast.loading('Auto-fixing shop domain...')
      const token = await firebaseUser.getIdToken()
      
      const response = await fetch('/api/fix-shop-domain', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ shopId: selectedShop.id }),
      })

      const data = await response.json()
      console.log('=== SHOP DOMAIN FIX RESULTS ===', data)
      
      if (response.ok && data.success) {
        toast.success(`Domain fixed! Old: ${data.oldDomain} -> New: ${data.newDomain}`)
        console.log('Shop info updated:', data.shopInfo)
        
        // Refresh collections after successful fix
        setTimeout(() => {
          fetchCollections()
        }, 1000)
      } else {
        toast.error(`Domain fix failed: ${data.error || data.message}`)
        if (data.testedDomains) {
          console.log('Tested domains:', data.testedDomains)
        }
      }
    } catch (error) {
      console.error('Domain fix error:', error)
      toast.error('Domain fix failed')
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  const getPublishedStatus = (collection: Collection) => {
    if (collection.published_at) {
      return 'Published'
    }
    return 'Draft'
  }

  if (!selectedShop) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <FolderOpen className="mr-2 h-5 w-5" />
            Collections
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <FolderOpen className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p>Select a shop to view collections</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <FolderOpen className="mr-2 h-5 w-5" />
            Collections ({filteredCollections.length})
          </div>
          {selectedShop && (
            <div className="flex space-x-2">
              <Button variant="outline" size="sm" onClick={fetchCollections}>
                <Loader2 className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={debugCollections}>
                Debug
              </Button>
              <Button variant="outline" size="sm" onClick={testAPI}>
                Test API
              </Button>
              <Button variant="outline" size="sm" onClick={runComprehensiveTest}>
                Full Test
              </Button>
              <Button variant="outline" size="sm" onClick={testShopCredentials}>
                Test Shop
              </Button>
              <Button variant="outline" size="sm" onClick={fixShopDomain}>
                Fix Domain
              </Button>
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading collections...</span>
          </div>
        ) : error ? (
          <div className="text-center py-8 text-red-500">
            <FolderOpen className="mx-auto h-12 w-12 text-red-400 mb-4" />
            <p>{error}</p>
            <Button variant="outline" onClick={fetchCollections} className="mt-4">
              Try Again
            </Button>
          </div>
        ) : (
          <>
            {/* Search */}
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search collections by title or handle..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Collections Table */}
            {filteredCollections.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {searchTerm ? 'No collections found matching your search.' : 'No collections found in this shop.'}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Image</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Handle</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sort Order</TableHead>
                    <TableHead>Rules</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCollections.map((collection) => (
                    <TableRow key={collection.id}>
                      <TableCell>
                        {collection.image ? (
                          <img
                            src={collection.image.src}
                            alt={collection.image.alt || collection.title}
                            className="h-12 w-12 object-cover rounded"
                          />
                        ) : (
                          <div className="h-12 w-12 bg-gray-200 rounded flex items-center justify-center">
                            <FolderOpen className="h-6 w-6 text-gray-400" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        {collection.title}
                      </TableCell>
                      <TableCell>
                        <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                          {collection.handle}
                        </code>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getPublishedStatus(collection) === 'Published' ? 'default' : 'secondary'}>
                          {getPublishedStatus(collection)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {collection.sort_order}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-gray-600">
                          {collection.rules.length} rule{collection.rules.length !== 1 ? 's' : ''}
                        </span>
                      </TableCell>
                      <TableCell>
                        {formatDate(collection.created_at)}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(`https://${selectedShop.shopifyDomain}/collections/${collection.handle}`, '_blank')}
                            title="View collection on store"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

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
  Eye,
  Check,
  RefreshCw
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
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
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

  const fetchCollections = async (isRefresh = false) => {
    if (!selectedShop) {
      setError('No shop selected')
      return
    }

    if (isRefresh) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }
    setError(null)
    setShowSuccess(false)
    
    try {
      if (!firebaseUser) {
        setError('Authentication required')
        toast.error('Please log in to view collections')
        return
      }

      const token = await firebaseUser.getIdToken()
      
      const response = await fetch(`/api/shops/${selectedShop.id}/collections`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })


      if (response.ok) {
        const data = await response.json()
        
        const collectionsArray = data.collections || []
        setCollections(collectionsArray)
        
        if (isRefresh) {
          // Show success state briefly
          setShowSuccess(true)
          setTimeout(() => setShowSuccess(false), 1500)
        }
        
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
        
        try {
          const errorData = responseText ? JSON.parse(responseText) : {}
          
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
          } else {
            toast.error(`Collections error: ${errorMessage}`)
          }
        } catch (parseError) {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`
          toast.error(`Network error: ${errorMessage}`)
        }
        
        setError(errorMessage)
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Network error occurred'
      setError(errorMessage)
      toast.error(`Connection error: ${errorMessage}`)
    } finally {
      if (isRefresh) {
        // Add a small delay for smoother animation
        setTimeout(() => {
          setIsRefreshing(false)
        }, 300)
      } else {
        setIsLoading(false)
      }
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
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => fetchCollections(true)}
              disabled={isRefreshing || isLoading}
            >
              {isRefreshing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : showSuccess ? (
                <Check className="mr-2 h-4 w-4 text-green-600" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Refresh
            </Button>
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
            <Button variant="outline" onClick={() => fetchCollections(false)} className="mt-4">
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

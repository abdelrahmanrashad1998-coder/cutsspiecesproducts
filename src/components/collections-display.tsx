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
import { DataTablePagination } from '@/components/ui/data-table-pagination'
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
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)
  const { firebaseUser } = useAuth()

  useEffect(() => {
    if (selectedShop) {
      fetchCollections()
    } else {
      setCollections([])
      setFilteredCollections([])
      setSearchTerm('')
      setError(null)
      setCurrentPage(1)
    }
  }, [selectedShop])

  useEffect(() => {
    const filtered = collections.filter(collection =>
      collection.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      collection.handle.toLowerCase().includes(searchTerm.toLowerCase())
    )
    setFilteredCollections(filtered)
    setCurrentPage(1) // Reset to first page when search changes
  }, [collections, searchTerm])

  // Calculate pagination
  const totalPages = Math.ceil(filteredCollections.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedCollections = filteredCollections.slice(startIndex, endIndex)

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage)
    setCurrentPage(1) // Reset to first page when changing items per page
  }

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
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FolderOpen className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-xl">Collections</CardTitle>
            <Badge variant="secondary" className="ml-2">
              {filteredCollections.length}
            </Badge>
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
        </div>
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
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search collections by title or handle..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Collections Table */}
            {filteredCollections.length === 0 ? (
              <div className="text-center py-12">
                <FolderOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground mb-2">
                  {searchTerm ? 'No collections found' : 'No collections available'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {searchTerm ? 'Try adjusting your search terms.' : 'Create your first collection to organize products.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Showing {filteredCollections.length} of {collections.length} collections
                  </p>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16 hidden sm:table-cell">Image</TableHead>
                      <TableHead className="min-w-[200px]">Collection</TableHead>
                      <TableHead className="min-w-[120px] hidden md:table-cell">Handle</TableHead>
                      <TableHead className="w-24">Status</TableHead>
                      <TableHead className="w-32 hidden lg:table-cell">Sort Order</TableHead>
                      <TableHead className="w-24 hidden lg:table-cell">Rules</TableHead>
                      <TableHead className="w-32 hidden lg:table-cell">Created</TableHead>
                      <TableHead className="w-24">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedCollections.map((collection) => (
                      <TableRow key={collection.id} className="group">
                        <TableCell className="hidden sm:table-cell">
                          <div className="relative">
                            {collection.image ? (
                              <img
                                src={collection.image.src}
                                alt={collection.image.alt || collection.title}
                                className="h-12 w-12 object-cover rounded-lg border"
                              />
                            ) : (
                              <div className="h-12 w-12 bg-muted rounded-lg flex items-center justify-center border">
                                <FolderOpen className="h-5 w-5 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <div className="sm:hidden">
                                {collection.image ? (
                                  <img
                                    src={collection.image.src}
                                    alt={collection.image.alt || collection.title}
                                    className="h-8 w-8 object-cover rounded border"
                                  />
                                ) : (
                                  <div className="h-8 w-8 bg-muted rounded flex items-center justify-center border">
                                    <FolderOpen className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-sm leading-tight truncate">{collection.title}</div>
                                <div className="md:hidden text-xs text-muted-foreground font-mono">
                                  #{collection.handle}
                                </div>
                                {collection.body_html && (
                                  <div className="text-xs text-muted-foreground line-clamp-1" 
                                       dangerouslySetInnerHTML={{ __html: collection.body_html }} />
                                )}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                            {collection.handle}
                          </code>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={getPublishedStatus(collection) === 'Published' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {getPublishedStatus(collection)}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <Badge variant="outline" className="text-xs">
                            {collection.sort_order}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <span className="text-sm text-muted-foreground">
                            {collection.rules.length} rule{collection.rules.length !== 1 ? 's' : ''}
                          </span>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <span className="text-sm text-muted-foreground">
                            {formatDate(collection.created_at)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(`https://${selectedShop.shopifyDomain}/collections/${collection.handle}`, '_blank')}
                              title="View collection on store"
                              className="h-8 w-8 p-0"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                
                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-4">
                    <DataTablePagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      totalItems={filteredCollections.length}
                      itemsPerPage={itemsPerPage}
                      onPageChange={handlePageChange}
                      onItemsPerPageChange={handleItemsPerPageChange}
                    />
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

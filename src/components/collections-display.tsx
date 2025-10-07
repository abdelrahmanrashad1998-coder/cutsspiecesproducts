'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
  const [itemsPerPage, setItemsPerPage] = useState(5)
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
      
      const response = await fetch(`/api/shops/${selectedShop.shopifyDomain}/collections`, {
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

            {/* Rows per page selector */}
            <div className="mb-4">
              <div className="flex items-center space-x-2">
                <p className="text-sm font-medium">Rows per page</p>
                <Select
                  value={`${itemsPerPage}`}
                  onValueChange={(value) => {
                    handleItemsPerPageChange(Number(value))
                  }}
                >
                  <SelectTrigger className="h-8 w-[70px]">
                    <SelectValue placeholder={itemsPerPage} />
                  </SelectTrigger>
                  <SelectContent side="top">
                    {[5, 10, 20, 30, 40, 50].map((pageSize) => (
                      <SelectItem key={pageSize} value={`${pageSize}`}>
                        {pageSize}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
                {/* Desktop Table */}
                <div className="hidden lg:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Image</TableHead>
                        <TableHead className="min-w-[200px]">Collection</TableHead>
                        <TableHead className="min-w-[120px]">Handle</TableHead>
                        <TableHead className="w-24">Status</TableHead>
                        <TableHead className="w-32">Sort Order</TableHead>
                        <TableHead className="w-24">Rules</TableHead>
                        <TableHead className="w-32">Created</TableHead>
                        <TableHead className="w-24">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedCollections.map((collection) => (
                        <TableRow key={collection.id} className="group">
                          <TableCell>
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
                              <div className="font-medium text-sm leading-tight">{collection.title}</div>
                              {collection.body_html && (
                                <div className="text-xs text-muted-foreground line-clamp-1" 
                                     dangerouslySetInnerHTML={{ __html: collection.body_html }} />
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
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
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {collection.sort_order}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {collection.rules.length} rule{collection.rules.length !== 1 ? 's' : ''}
                            </span>
                          </TableCell>
                          <TableCell>
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
                </div>

                {/* Mobile Card Layout */}
                <div className="lg:hidden space-y-3">
                  {paginatedCollections.map((collection) => (
                    <div key={collection.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0">
                          {collection.image ? (
                            <img
                              src={collection.image.src}
                              alt={collection.image.alt || collection.title}
                              className="h-16 w-16 object-cover rounded-lg border"
                            />
                          ) : (
                            <div className="h-16 w-16 bg-muted rounded-lg flex items-center justify-center border">
                              <FolderOpen className="h-6 w-6 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm leading-tight mb-1">{collection.title}</h3>
                          <code className="text-xs bg-muted px-2 py-1 rounded font-mono mb-2 block w-fit">
                            #{collection.handle}
                          </code>
                          <div className="flex items-center space-x-2 mb-2">
                            <Badge 
                              variant={getPublishedStatus(collection) === 'Published' ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {getPublishedStatus(collection)}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {collection.sort_order}
                            </Badge>
                          </div>
                          {collection.body_html && (
                            <div className="text-xs text-muted-foreground line-clamp-2 mb-2" 
                                 dangerouslySetInnerHTML={{ __html: collection.body_html }} />
                          )}
                          <p className="text-xs text-muted-foreground">
                            {collection.rules.length} rule{collection.rules.length !== 1 ? 's' : ''} • Created: {formatDate(collection.created_at)}
                          </p>
                        </div>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex items-center justify-end space-x-2 pt-2 border-t">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(`https://${selectedShop.shopifyDomain}/collections/${collection.handle}`, '_blank')}
                          className="h-8 px-3 text-xs"
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          View
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Pagination */}
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
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

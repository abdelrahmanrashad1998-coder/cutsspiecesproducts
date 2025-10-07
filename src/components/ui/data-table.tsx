"use client"

import * as React from "react"
import { ArrowUpDown, ChevronDown, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export type ColumnDef<TData, TValue = unknown> = {
  accessorKey?: keyof TData
  id?: string
  header: ({ column }: { column: any }) => React.ReactNode
  cell: ({ row }: { row: any }) => React.ReactNode
  enableSorting?: boolean
  enableHiding?: boolean
}

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  searchKey?: string
  searchPlaceholder?: string
  onSearch?: (value: string) => void
  searchValue?: string
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchKey,
  searchPlaceholder = "Search...",
  onSearch,
  searchValue = "",
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<any[]>([])
  const [columnVisibility, setColumnVisibility] = React.useState<any>({})
  const [rowSelection, setRowSelection] = React.useState({})

  const table = {
    getHeaderGroups: () => [
      {
        headers: columns.map((column, index) => ({
          id: column.id || column.accessorKey || index.toString(),
          column: {
            id: column.id || column.accessorKey || index.toString(),
            toggleSorting: (desc?: boolean) => {
              setSorting(prev => {
                const existing = prev.find(s => s.id === column.id)
                if (existing) {
                  return prev.map(s => 
                    s.id === column.id 
                      ? { ...s, desc: desc ?? !s.desc }
                      : s
                  )
                }
                return [...prev, { id: column.id || column.accessorKey, desc: desc ?? false }]
              })
            },
            getIsSorted: () => {
              const sort = sorting.find(s => s.id === column.id || s.id === column.accessorKey)
              if (!sort) return false
              return sort.desc ? "desc" : "asc"
            }
          }
        }))
      }
    ],
    getRowModel: () => ({
      rows: data.map((row, index) => ({
        id: index.toString(),
        original: row,
        getValue: (key: string) => (row as any)[key]
      }))
    }),
    getCanPreviousPage: () => false,
    getCanNextPage: () => false,
    getIsSomePageSelected: () => false,
    getIsAllPageSelected: () => false,
    toggleAllPageRowsSelected: () => {},
    getToggleAllPageRowsSelectedHandler: () => () => {},
    getIsSomeRowsSelected: () => false,
    getIsAllRowsSelected: () => false,
    toggleAllRowsSelected: () => {},
    getToggleAllRowsSelectedHandler: () => () => {},
    getSelectedRowModel: () => ({ rows: [] }),
    getPrePaginationRowModel: () => ({ rows: [] }),
    getAllColumns: () => columns.map((column, index) => ({
      id: column.id || column.accessorKey || index.toString(),
      getCanHide: () => column.enableHiding !== false,
      getIsVisible: () => columnVisibility[column.id || column.accessorKey || index.toString()] !== false,
      toggleVisibility: (value?: boolean) => {
        setColumnVisibility(prev => ({
          ...prev,
          [column.id || column.accessorKey || index.toString()]: value
        }))
      }
    }))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-1 items-center space-x-2">
          {onSearch && (
            <div className="relative flex-1 max-w-sm">
              <input
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={(e) => onSearch(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="ml-auto">
              Columns <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => {
                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) =>
                      column.toggleVisibility(!!value)
                    }
                  >
                    {column.id}
                  </DropdownMenuCheckboxItem>
                )
              })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.headers.length}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.column.getCanSort() ? (
                        <Button
                          variant="ghost"
                          onClick={() => header.column.toggleSorting(undefined)}
                        >
                          {columns.find(c => (c.id || c.accessorKey) === header.id)?.header({ column: header.column })}
                          <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                      ) : (
                        columns.find(c => (c.id || c.accessorKey) === header.id)?.header({ column: header.column })
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {columns.map((column, index) => (
                    <TableCell key={index}>
                      {column.cell({ row })}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

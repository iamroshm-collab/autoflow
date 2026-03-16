'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/components/ui/notify'

interface StockReport {
  productId: number
  productName: string
  category: string
  supplier: string
  unit: string
  totalPurchased: number
  totalSold: number
  totalReturned: number
  currentBalance: number
  purchasePrice: number
  salePrice: number
  balanceValue: number
}

export function InventoryReportComponent() {
  const [stockReport, setStockReport] = useState<StockReport[]>([])
  const [filteredReport, setFilteredReport] = useState<StockReport[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterSupplier, setFilterSupplier] = useState<string>('all')
  const [searchProduct, setSearchProduct] = useState('')
  const [categories, setCategories] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])

  // Fetch inventory data
  const fetchInventoryData = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/inventory/report')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to fetch inventory report')
      }

      const reportData = Array.isArray(data?.report)
        ? data.report
        : Array.isArray(data)
          ? data
          : []

      setStockReport(reportData)
      setFilteredReport(reportData)

      // Extract unique categories and suppliers
      const uniqueCategories = [...new Set(reportData.map((item: any) => item.category))]
      const uniqueSuppliers = [...new Set(reportData.map((item: any) => item.supplier))]
      setCategories(uniqueCategories)
      setSuppliers(uniqueSuppliers)
    } catch (error) {
      console.error('Error fetching inventory:', error)
      toast({
        title: 'Error',
        description: 'Failed to load inventory report',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Apply filters
  useEffect(() => {
    let filtered = stockReport

    if (filterCategory !== 'all') {
      filtered = filtered.filter((item) => item.category === filterCategory)
    }

    if (filterSupplier !== 'all') {
      filtered = filtered.filter((item) => item.supplier === filterSupplier)
    }

    if (searchProduct) {
      filtered = filtered.filter((item) =>
        item.productName.toLowerCase().includes(searchProduct.toLowerCase())
      )
    }

    setFilteredReport(filtered)
  }, [filterCategory, filterSupplier, searchProduct, stockReport])

  // Load data on mount
  useEffect(() => {
    fetchInventoryData()
  }, [])

  // Calculate summary for products with low stock
  const lowStockItems = filteredReport.filter((item) => item.currentBalance < 10)
  const totalValue = filteredReport.reduce((sum, item) => sum + item.balanceValue, 0)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">Inventory & Stock Balance Report</h2>
        <p className="text-sm text-muted-foreground">
          Track purchased, sold, and returned inventory with real-time stock balances
        </p>
      </div>

          {/* Filters */}
          <div className="grid gap-4 md:grid-cols-5">
            <div className="space-y-2">
              <Label htmlFor="search">Search Product</Label>
              <Input
                id="search"
                value={searchProduct}
                onChange={(e) => setSearchProduct(e.target.value)}
                className="h-8"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat || 'Uncategorized'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="supplier">Supplier</Label>
              <Select value={filterSupplier} onValueChange={setFilterSupplier}>
                <SelectTrigger id="supplier">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Suppliers</SelectItem>
                  {suppliers.map((sup) => (
                    <SelectItem key={sup} value={sup}>
                      {sup}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={fetchInventoryData}
                disabled={isLoading}
                className="w-full h-8"
              >
                {isLoading ? 'Refreshing...' : 'Refresh'}
              </Button>
            </div>

            <div className="flex items-end">
              <Button variant="outline" className="w-full h-8">
                Export to CSV
              </Button>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="bg-blue-50">
              <CardContent className="pt-6">
                <div className="text-sm font-medium text-gray-600">Total Value</div>
                <div className="mt-2 text-2xl font-bold text-blue-600">₹{totalValue.toFixed(2)}</div>
                <div className="mt-1 text-xs text-gray-500">{filteredReport.length} products</div>
              </CardContent>
            </Card>

            <Card className="bg-green-50">
              <CardContent className="pt-6">
                <div className="text-sm font-medium text-gray-600">In Stock</div>
                <div className="mt-2 text-2xl font-bold text-green-600">
                  {filteredReport.filter((item) => item.currentBalance > 0).length}
                </div>
                <div className="mt-1 text-xs text-gray-500">products</div>
              </CardContent>
            </Card>

            <Card className="bg-yellow-50">
              <CardContent className="pt-6">
                <div className="text-sm font-medium text-gray-600">Low Stock</div>
                <div className="mt-2 text-2xl font-bold text-yellow-600">{lowStockItems.length}</div>
                <div className="mt-1 text-xs text-gray-500">below 10 units</div>
              </CardContent>
            </Card>

            <Card className="bg-red-50">
              <CardContent className="pt-6">
                <div className="text-sm font-medium text-gray-600">Out of Stock</div>
                <div className="mt-2 text-2xl font-bold text-red-600">
                  {filteredReport.filter((item) => item.currentBalance === 0).length}
                </div>
                <div className="mt-1 text-xs text-gray-500">products</div>
              </CardContent>
            </Card>
          </div>

          {/* Low Stock Alert */}
          {lowStockItems.length > 0 && (
            <div className="rounded-md border-l-4 border-yellow-500 bg-yellow-50 p-4">
              <div className="font-semibold text-yellow-800">
                ⚠️ {lowStockItems.length} products have low stock levels
              </div>
              <div className="mt-2 text-sm text-yellow-700">
                {lowStockItems.slice(0, 5).map((item) => (
                  <div key={item.productId}>
                    • {item.productName}: {item.currentBalance} {item.unit}
                  </div>
                ))}
                {lowStockItems.length > 5 && <div>• ...and {lowStockItems.length - 5} more</div>}
              </div>
            </div>
          )}

          {/* Data Table */}
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader className="bg-gray-100">
                <TableRow>
                  <TableHead className="min-w-32">Product Name</TableHead>
                  <TableHead className="min-w-24">Category</TableHead>
                  <TableHead className="min-w-24">Supplier</TableHead>
                  <TableHead className="text-right">Total Purchased</TableHead>
                  <TableHead className="text-right">Total Sold</TableHead>
                  <TableHead className="text-right">Total Returned</TableHead>
                  <TableHead className="text-right">Current Balance</TableHead>
                  <TableHead className="text-right">Unit</TableHead>
                  <TableHead className="text-right">Purchase Price</TableHead>
                  <TableHead className="text-right">Sale Price</TableHead>
                  <TableHead className="text-right">Balance Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={11} className="py-8 text-center text-gray-500">
                      Loading inventory data...
                    </TableCell>
                  </TableRow>
                ) : filteredReport.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="py-8 text-center text-gray-500">
                      No products found. Try adjusting your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredReport.map((item) => (
                    <TableRow
                      key={item.productId}
                      className={
                        item.currentBalance === 0
                          ? 'bg-red-50'
                          : item.currentBalance < 10
                            ? 'bg-yellow-50'
                            : ''
                      }
                    >
                      <TableCell className="font-medium">{item.productName}</TableCell>
                      <TableCell>{item.category || '-'}</TableCell>
                      <TableCell>{item.supplier}</TableCell>
                      <TableCell className="text-right">{item.totalPurchased}</TableCell>
                      <TableCell className="text-right">{item.totalSold}</TableCell>
                      <TableCell className="text-right">{item.totalReturned}</TableCell>
                      <TableCell
                        className={`text-right font-semibold ${
                          item.currentBalance === 0
                            ? 'text-red-600'
                            : item.currentBalance < 10
                              ? 'text-yellow-600'
                              : ''
                        }`}
                      >
                        {item.currentBalance}
                      </TableCell>
                      <TableCell className="text-right">{item.unit}</TableCell>
                      <TableCell className="text-right">₹{item.purchasePrice.toFixed(2)}</TableCell>
                      <TableCell className="text-right">₹{item.salePrice.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-semibold">
                        ₹{item.balanceValue.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Footer Info */}
          <div className="flex justify-between border-t pt-4 text-sm text-gray-600">
            <div>Total Records: {filteredReport.length}</div>
            <div>Last Updated: {new Date().toLocaleString()}</div>
          </div>

    </div>
  )
}

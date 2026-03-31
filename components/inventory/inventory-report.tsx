'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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
  lastUpdated?: string
}

export function InventoryReportComponent() {
  const [stockReport, setStockReport] = useState<StockReport[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [supplierFilter, setSupplierFilter] = useState<string>('all')

  const fetchInventoryData = useCallback(async () => {
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
  }, [])

  const filteredReport = useMemo(() => {
    if (!supplierFilter || supplierFilter === 'all') {
      return stockReport
    }
    return stockReport.filter((item) => String(item.supplier || '') === supplierFilter)
  }, [stockReport, supplierFilter])

  const exportToCsv = useCallback(() => {
    const rows = filteredReport
    if (rows.length === 0) {
      toast({ title: 'No data', description: 'No rows available to export.' })
      return
    }

    const headers = [
      'Product Name',
      'Category',
      'Supplier',
      'Total Purchased',
      'Total Sold',
      'Total Returned',
      'Current Balance',
      'Unit',
      'Purchase Price',
      'Sale Price',
      'Balance Value',
    ]

    const escapeCsv = (value: string | number) => {
      const str = String(value ?? '')
      return `"${str.replace(/"/g, '""')}"`
    }

    const body = rows.map((item) => [
      item.productName,
      item.category || '',
      item.supplier || '',
      item.totalPurchased,
      item.totalSold,
      item.totalReturned,
      item.currentBalance,
      item.unit,
      item.purchasePrice.toFixed(2),
      item.salePrice.toFixed(2),
      item.balanceValue.toFixed(2),
    ].map(escapeCsv).join(','))

    const csv = [headers.map(escapeCsv).join(','), ...body].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `inventory-report-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }, [filteredReport])

  useEffect(() => {
    fetchInventoryData()
  }, [fetchInventoryData])

  useEffect(() => {
    const onRefresh = () => {
      void fetchInventoryData()
    }
    const onExportCsv = () => {
      exportToCsv()
    }
    const onSetSupplier = (event: Event) => {
      const customEvent = event as CustomEvent<{ supplier?: string }>
      const nextSupplier = String(customEvent.detail?.supplier || 'all')
      setSupplierFilter(nextSupplier || 'all')
    }

    window.addEventListener('inventoryPosInventory:refresh', onRefresh)
    window.addEventListener('inventoryPosInventory:exportCsv', onExportCsv)
    window.addEventListener('inventoryPosInventory:setSupplier', onSetSupplier as EventListener)

    return () => {
      window.removeEventListener('inventoryPosInventory:refresh', onRefresh)
      window.removeEventListener('inventoryPosInventory:exportCsv', onExportCsv)
      window.removeEventListener('inventoryPosInventory:setSupplier', onSetSupplier as EventListener)
    }
  }, [exportToCsv, fetchInventoryData])

  const lowStockItems = filteredReport.filter((item) => item.currentBalance < 10)
  const totalValue = filteredReport.reduce((sum, item) => sum + item.balanceValue, 0)

  return (
    <div className="space-y-6">
      {/* Summary Cards moved to top */}
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

      {/* Data Table */}
      <div className="inventory-pos-table-wrapper inventory-pos-inventory-table-wrapper">
        <Table>
          <TableHeader className="bg-gray-100 sticky top-0 z-10">
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
                  <TableCell className="text-right font-semibold">₹{item.balanceValue.toFixed(2)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="!mt-3 flex justify-between border-t pt-2 text-sm text-gray-600">
        <div>Total Records: {filteredReport.length}</div>
        <div>Last Updated: {new Date().toLocaleString()}</div>
      </div>
    </div>
  )
}

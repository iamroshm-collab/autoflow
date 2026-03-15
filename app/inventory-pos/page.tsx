'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PurchaseEntryForm } from '@/components/inventory/purchase-entry'
import { POSSalesForm } from '@/components/inventory/pos-sales'
import { InventoryReportComponent } from '@/components/inventory/inventory-report'

export default function InventoryPOSPage() {
  const [activeTab, setActiveTab] = useState('purchase')

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="border-b bg-white px-6 py-8 shadow-sm">
          <h1 className="text-4xl font-bold text-slate-900">Inventory & POS System</h1>
          <p className="mt-2 text-lg text-slate-600">
            Manage purchases, sales, and track inventory in real-time
          </p>
        </div>

        {/* Tabs */}
        <div className="p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 border-b-0">
              <TabsTrigger value="purchase" className="w-full">
                <span className="mr-2">📦</span>
                Purchase Entry
              </TabsTrigger>
              <TabsTrigger value="sales" className="w-full">
                <span className="mr-2">🛒</span>
                POS Sales
              </TabsTrigger>
              <TabsTrigger value="inventory" className="w-full">
                <span className="mr-2">📊</span>
                Inventory Report
              </TabsTrigger>
            </TabsList>

            {/* Purchase Entry Tab */}
            <TabsContent value="purchase" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-4">
                <Card className="bg-blue-50">
                  <CardContent className="pt-6">
                    <div className="text-sm font-medium text-gray-600">Today's Purchases</div>
                    <div className="mt-2 text-2xl font-bold text-blue-600">0</div>
                  </CardContent>
                </Card>
                <Card className="bg-green-50">
                  <CardContent className="pt-6">
                    <div className="text-sm font-medium text-gray-600">Total Suppliers</div>
                    <div className="mt-2 text-2xl font-bold text-green-600">0</div>
                  </CardContent>
                </Card>
                <Card className="bg-purple-50">
                  <CardContent className="pt-6">
                    <div className="text-sm font-medium text-gray-600">Products Added</div>
                    <div className="mt-2 text-2xl font-bold text-purple-600">0</div>
                  </CardContent>
                </Card>
                <Card className="bg-orange-50">
                  <CardContent className="pt-6">
                    <div className="text-sm font-medium text-gray-600">Total Amount</div>
                    <div className="mt-2 text-2xl font-bold text-orange-600">₹0</div>
                  </CardContent>
                </Card>
              </div>
              <PurchaseEntryForm />
            </TabsContent>

            {/* POS Sales Tab */}
            <TabsContent value="sales" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-4">
                <Card className="bg-blue-50">
                  <CardContent className="pt-6">
                    <div className="text-sm font-medium text-gray-600">Today's Sales</div>
                    <div className="mt-2 text-2xl font-bold text-blue-600">0</div>
                  </CardContent>
                </Card>
                <Card className="bg-green-50">
                  <CardContent className="pt-6">
                    <div className="text-sm font-medium text-gray-600">Total Customers</div>
                    <div className="mt-2 text-2xl font-bold text-green-600">0</div>
                  </CardContent>
                </Card>
                <Card className="bg-red-50">
                  <CardContent className="pt-6">
                    <div className="text-sm font-medium text-gray-600">Returns</div>
                    <div className="mt-2 text-2xl font-bold text-red-600">0</div>
                  </CardContent>
                </Card>
                <Card className="bg-orange-50">
                  <CardContent className="pt-6">
                    <div className="text-sm font-medium text-gray-600">Total Revenue</div>
                    <div className="mt-2 text-2xl font-bold text-orange-600">₹0</div>
                  </CardContent>
                </Card>
              </div>
              <POSSalesForm />
            </TabsContent>

            {/* Inventory Report Tab */}
            <TabsContent value="inventory" className="space-y-4">
              <InventoryReportComponent />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}

"use client"

import dynamic from "next/dynamic"

const SupplierProductInventoryForm = dynamic(
  () => import("@/components/dashboard/supplier-product-inventory-form").then((m) => m.SupplierProductInventoryForm),
  { ssr: false }
)

export default function TestNumberPage() {
  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold mb-4">Test: Supplier Product Inventory Form</h2>
      <SupplierProductInventoryForm />
    </div>
  )
}

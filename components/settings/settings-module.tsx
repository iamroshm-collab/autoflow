"use client"

import React, { useState, useEffect, useMemo, useRef } from "react"
import { Card } from "@/components/ui/card"
import { EdgeTabs } from "@/components/ui/edge-tabs"
import { Store, Package, MapPin } from "lucide-react"
import ShopSettingsForm from "./shop-settings-form"
import SparePartShopsForm from "./spare-part-shops-form"
import GSTStatesForm from "./gst-states-form"

export default function SettingsModule() {
  const [activeTab, setActiveTab] = useState("shop")

  return (
    <div className="space-y-6">
      <EdgeTabs
        tabs={[
          { key: "shop", label: "Shop Settings", icon: <Store /> },
          { key: "spare-parts", label: "Spare Part Shops", icon: <Package /> },
          { key: "gst-states", label: "GST States", icon: <MapPin /> },
        ]}
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k)}
        syncWithPath={false}
        navigateOnClick={false}
        className="w-full"
      />

      <div className="mt-6">
        {activeTab === "shop" && <ShopSettingsForm />}

        {activeTab === "spare-parts" && <SparePartShopsForm />}

        {activeTab === "gst-states" && <GSTStatesForm />}
      </div>
    </div>
  )
}

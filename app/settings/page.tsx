"use client"

import { useState } from "react"
import SettingsModule from "@/components/settings/settings-module"
import { EdgeTabs } from "@/components/ui/edge-tabs"
import { Store, Package, MapPin } from "lucide-react"

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<"shop" | "spare-parts" | "gst-states">("shop")

  return (
    <div className="space-y-6">
      <EdgeTabs
        tabs={[
          { key: "shop", label: "Shop Settings", icon: <Store /> },
          { key: "spare-parts", label: "Spare Part Shops", icon: <Package /> },
          { key: "gst-states", label: "GST States", icon: <MapPin /> },
        ]}
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k as "shop" | "spare-parts" | "gst-states")}
        syncWithPath={false}
        navigateOnClick={false}
        className="settings-page-tabs"
      />

      <SettingsModule activeTab={activeTab} />
    </div>
  )
}

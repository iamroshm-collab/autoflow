"use client"

import React from "react"
import ShopSettingsForm from "./shop-settings-form"
import GSTStatesForm from "./gst-states-form"

interface SettingsModuleProps {
  activeTab: "shop" | "gst-states"
}

export default function SettingsModule({ activeTab }: SettingsModuleProps) {
  const panelCornerClass = activeTab === "shop" ? "rounded-tl-none" : ""

  return (
    <div className="h-full min-h-0">
      <div className="h-full min-h-0">
        {activeTab === "shop" && <ShopSettingsForm panelCornerClass={panelCornerClass} />}

        {activeTab === "gst-states" && <GSTStatesForm panelCornerClass={panelCornerClass} />}
      </div>
    </div>
  )
}

"use client"

import dynamic from "next/dynamic"
import { Suspense } from "react"

const LiveChatMonitorPage = dynamic(
  () => import("@/app/admin/messages/page").then((m) => m.default),
  {
    loading: () => (
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        fontSize: "14px",
        color: "#667781"
      }}>
        Loading messaging interface...
      </div>
    ),
    ssr: false
  }
)

export function WhatsAppAdminMessages({ onContactChange }: { onContactChange?: (name: string | null) => void }) {
  return (
    <div style={{ padding: "1mm", height: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column", background: "transparent" }}>
      <div style={{ flex: 1, borderRadius: "12px", overflow: "hidden", minHeight: 0, boxShadow: "0 2px 16px rgba(0,0,0,0.18)", border: "1px solid #d1d5db" }}>
        <Suspense fallback={<div>Loading...</div>}>
          <LiveChatMonitorPage onContactChange={onContactChange} />
        </Suspense>
      </div>
    </div>
  )
}

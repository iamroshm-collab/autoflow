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
    <div style={{ height: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column", background: "transparent" }}>
      <div style={{ flex: 1, overflow: "hidden", minHeight: 0 }}>
        <Suspense fallback={<div>Loading...</div>}>
          <LiveChatMonitorPage onContactChange={onContactChange} />
        </Suspense>
      </div>
    </div>
  )
}

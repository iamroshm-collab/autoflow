"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"

type MessageItem = {
  id: string
  senderName: string | null
  phoneNumber: string | null
  content: string
  timestamp: string | null
  status: string
  messageType?: string | null
  isOutgoing?: boolean
  profilePicture?: string | null
}

type MessageApiResponse = {
  messages?: MessageItem[]
  fetchedAt?: string
  error?: string
}

type SendReplyResponse = {
  success?: boolean
  error?: string
}

type ContactSummary = {
  key: string
  senderName: string
  phoneNumber: string | null
  preview: string
  lastTimestamp: string | null
  unreadCount: number
  totalMessages: number
}

const REFRESH_INTERVAL_MS = 30_000

const statusBadgeClass = (status: string) => {
  const normalized = status.toLowerCase()

  if (normalized.includes("reply") || normalized.includes("sent")) {
    return "bg-emerald-500/20 text-emerald-200 border-emerald-300/30"
  }

  if (normalized.includes("receive") || normalized.includes("new")) {
    return "bg-sky-500/20 text-sky-200 border-sky-300/30"
  }

  return "bg-white/10 text-slate-100 border-white/20"
}

const formatTimeOnly = (timestamp: string | null) => {
  if (!timestamp) {
    return "-"
  }

  const parsed = new Date(timestamp)
  if (Number.isNaN(parsed.getTime())) {
    return "-"
  }

  return parsed.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  })
}

const formatDateSeparator = (timestamp: string | null) => {
  if (!timestamp) {
    return "-"
  }

  const parsed = new Date(timestamp)
  if (Number.isNaN(parsed.getTime())) {
    return "-"
  }

  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const isSameDay = (d1: Date, d2: Date) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()

  if (isSameDay(parsed, today)) {
    return "Today"
  } else if (isSameDay(parsed, yesterday)) {
    return "Yesterday"
  } else {
    return parsed.toLocaleDateString("en-IN", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "2-digit"
    })
  }
}

const getDayKey = (timestamp: string | null) => {
  if (!timestamp) {
    return "unknown"
  }
  const parsed = new Date(timestamp)
  if (Number.isNaN(parsed.getTime())) {
    return "unknown"
  }
  return `${parsed.getFullYear()}-${parsed.getMonth()}-${parsed.getDate()}`
}

const isUnreadStatus = (status: string) => {
  const normalized = status.toLowerCase()
  return normalized.includes("receive") || normalized.includes("new")
}

export default function LiveChatMonitorPage({ onContactChange }: { onContactChange?: (name: string | null) => void } = {}) {
  const [messages, setMessages] = useState<MessageItem[]>([])
  const [selectedContactKey, setSelectedContactKey] = useState<string | null>(null)
  const [draftReply, setDraftReply] = useState("")
  const [searchPhone, setSearchPhone] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [sendNotification, setSendNotification] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [activeFilter, setActiveFilter] = useState<"all" | "unread" | "favorites" | "groups">("all")
  const [viewedConversations, setViewedConversations] = useState<Set<string>>(new Set())
  const [favoriteContacts, setFavoriteContacts] = useState<Set<string>>(new Set())
  const mountedRef = useRef(true)
  const previousContactKeyRef = useRef<string | null>(null)
  const lastSendTimeRef = useRef<number>(0)

  const loadMessages = useCallback(async (showLoader: boolean) => {
    // Skip polling if we just sent a message (within 3 seconds) to avoid race conditions
    const timeSinceLastSend = Date.now() - lastSendTimeRef.current
    if (timeSinceLastSend < 3000 && !showLoader) {
      // Skip this refresh cycle if we just sent a message
      return
    }

    if (showLoader) {
      setIsLoading(true)
    } else {
      setIsRefreshing(true)
    }

    try {
      const response = await fetch("/api/admin/messages", { cache: "no-store" })
      const data = (await response.json()) as MessageApiResponse

      if (!mountedRef.current) {
        return
      }

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch messages")
      }

      setMessages(Array.isArray(data.messages) ? data.messages : [])
      setLastUpdated(data.fetchedAt || new Date().toISOString())
      setError(null)
    } catch (fetchError) {
      const message =
        fetchError instanceof Error
          ? fetchError.message
          : "Unable to refresh live messages"
      if (mountedRef.current) {
        setError(message)
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    void loadMessages(true)

    const intervalId = window.setInterval(() => {
      void loadMessages(false)
    }, REFRESH_INTERVAL_MS)

    return () => {
      mountedRef.current = false
      window.clearInterval(intervalId)
    }
  }, [loadMessages])

  const contactSummaries = useMemo(() => {
    const grouped = new Map<string, ContactSummary>()

    messages.forEach((message) => {
      const key = message.phoneNumber?.trim() || `unknown-${message.id}`
      const existing = grouped.get(key)

      if (!existing) {
        grouped.set(key, {
          key,
          senderName: message.senderName || "Unknown Sender",
          phoneNumber: message.phoneNumber,
          preview: message.content || "-",
          lastTimestamp: message.timestamp,
          unreadCount: isUnreadStatus(message.status) ? 1 : 0,
          totalMessages: 1,
        })
        return
      }

      const existingTime = existing.lastTimestamp ? new Date(existing.lastTimestamp).getTime() : 0
      const currentTime = message.timestamp ? new Date(message.timestamp).getTime() : 0

      if (currentTime >= existingTime) {
        existing.preview = message.content || "-"
        existing.lastTimestamp = message.timestamp
        existing.senderName = message.senderName || existing.senderName
      }

      existing.totalMessages += 1
      if (isUnreadStatus(message.status)) {
        existing.unreadCount += 1
      }
    })

    return Array.from(grouped.values()).sort((a, b) => {
      const aTime = a.lastTimestamp ? new Date(a.lastTimestamp).getTime() : 0
      const bTime = b.lastTimestamp ? new Date(b.lastTimestamp).getTime() : 0
      return bTime - aTime
    })
  }, [messages])

  const filteredContacts = useMemo(() => {
    let contacts = contactSummaries

    // Apply active filter
    if (activeFilter === "unread") {
      contacts = contacts.filter((contact) => {
        return !viewedConversations.has(contact.key) && contact.unreadCount > 0
      })
    } else if (activeFilter === "favorites") {
      contacts = contacts.filter((contact) => {
        return favoriteContacts.has(contact.key)
      })
    } else if (activeFilter === "groups") {
      contacts = contacts.filter((contact) => {
        return contact.senderName?.toLowerCase().includes("group")
      })
    }
    // "all" shows all contacts

    // Apply search filter
    const query = searchPhone.trim().toLowerCase()
    if (query) {
      contacts = contacts.filter((contact) => {
        const phone = (contact.phoneNumber || "").toLowerCase()
        const name = contact.senderName.toLowerCase()
        return phone.includes(query) || name.includes(query)
      })
    }

    return contacts
  }, [contactSummaries, searchPhone, activeFilter, viewedConversations, favoriteContacts])

  useEffect(() => {
    if (!filteredContacts.length) {
      setSelectedContactKey(null)
      return
    }

    if (!selectedContactKey || !filteredContacts.some((contact) => contact.key === selectedContactKey)) {
      setSelectedContactKey(filteredContacts[0].key)
    }
  }, [filteredContacts, selectedContactKey])

  useEffect(() => {
    if (selectedContactKey && !viewedConversations.has(selectedContactKey)) {
      setViewedConversations((prev) => new Set([...prev, selectedContactKey]))
    }
  }, [selectedContactKey, viewedConversations])

  const selectedContact = useMemo(
    () => filteredContacts.find((contact) => contact.key === selectedContactKey) || null,
    [filteredContacts, selectedContactKey]
  )

  const activeConversation = useMemo(() => {
    if (!selectedContact) {
      return []
    }

    const rows = messages.filter((message) => {
      const key = message.phoneNumber?.trim() || `unknown-${message.id}`
      return key === selectedContact.key
    })

    return rows.sort((a, b) => {
      const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0
      const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0
      return aTime - bTime
    })
  }, [messages, selectedContact])

  useEffect(() => {
    // Only set draft if the contact key actually changed to a different contact
    if (selectedContactKey === previousContactKeyRef.current) {
      // Contact hasn't changed, don't overwrite the draft
      return
    }

    previousContactKeyRef.current = selectedContactKey

    if (!selectedContact) {
      setDraftReply("")
      onContactChange?.(null)
      return
    }

    // Set default draft template for new contact
    setDraftReply(`Hi ${selectedContact.senderName}, thanks for contacting AutoFlow Garage. How can we help you further?`)
    onContactChange?.(selectedContact.senderName)
  }, [selectedContactKey, selectedContact, onContactChange])

  const totalUnread = useMemo(
    () => contactSummaries.reduce((count, contact) => {
      if (viewedConversations.has(contact.key)) {
        return count
      }
      return count + contact.unreadCount
    }, 0),
    [contactSummaries, viewedConversations]
  )

  const groupCount = useMemo(
    () => contactSummaries.filter((contact) => contact.senderName?.toLowerCase().includes("group")).length,
    [contactSummaries]
  )

  const handleSendReply = async () => {
    if (!selectedContact?.phoneNumber) {
      setSendNotification({ type: "error", text: "Customer phone number is missing." })
      return
    }

    const message = draftReply.trim()
    if (!message) {
      setSendNotification({ type: "error", text: "Reply message cannot be empty." })
      return
    }

    setIsSending(true)
    setSendNotification(null)

    try {
      const response = await fetch("/api/whatsapp/send-message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: selectedContact.phoneNumber,
          message,
        }),
      })

      const data = (await response.json().catch(() => ({}))) as SendReplyResponse
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to send WhatsApp reply")
      }

      // Record when the message was sent to prevent polling race conditions
      lastSendTimeRef.current = Date.now()

      // Add optimistic message to the UI
      const newMessage: MessageItem = {
        id: `temp-${Date.now()}`,
        senderName: "You",
        phoneNumber: selectedContact.phoneNumber,
        content: message,
        timestamp: new Date().toISOString(),
        status: "sent",
        messageType: "outgoing",
        isOutgoing: true
      }
      
      setMessages((prev) => [...prev, newMessage])
      setDraftReply("")
      setSendNotification({ type: "success", text: "Message sent successfully." })
    } catch (sendError) {
      const messageText = sendError instanceof Error ? sendError.message : "Failed to send WhatsApp reply"
      setSendNotification({ type: "error", text: messageText })
    } finally {
      setIsSending(false)
    }
  }

  useEffect(() => {
    if (!sendNotification) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setSendNotification(null)
    }, 3000)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [sendNotification])

  return (
    <main style={{
      fontFamily: "'Segoe UI', Helvetica, Arial, sans-serif",
      background: "#f0f2f5",
      display: "flex",
      flex: 1,
      alignItems: "stretch",
      justifyContent: "center",
      height: "100%",
      margin: 0,
      padding: 0
    }}>
      <style>{`
        :root {
          --g: #00a884;
          --gd: #008069;
          --bg: #f0f2f5;
          --panel: #fff;
          --hdr: #f0f2f5;
          --div: #e9edef;
          --t1: #111b21;
          --t2: #667781;
          --ic: #54656f;
          --unr: #25d366;
          --chat-bg: #efeae2;
          --bub-in: #fff;
          --bub-out: #d9fdd3;
          --srch: #f0f2f5;
          --hov: #f5f6f6;
          --act: #e9edef;
          --blue: #53bdeb;
        }
        * { box-sizing: border-box; }
        input::placeholder { color: var(--t2); }
        textarea::placeholder { color: var(--t2); }
        ::-webkit-scrollbar { width: 8px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #ccc; border-radius: 4px; }
      `}</style>
      
      <div style={{ display: "flex", width: "100%", height: "100%", flex: 1, background: "var(--panel)", overflow: "hidden" }}>
        
        {/* LEFT PANEL */}
        <div style={{
          width: "420px",
          minWidth: "310px",
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          borderRight: "1px solid var(--div)",
          background: "var(--panel)"
        }}>
          {/* Search */}
          <div style={{ padding: "8px 12px 8px", flexShrink: 0 }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "#f0f0f0",
              borderRadius: "24px",
              padding: "1px 16px"
            }}>
              <svg style={{
                width: "16px",
                height: "16px",
                flexShrink: 0,
                color: "#999",
                stroke: "currentColor",
                strokeWidth: "2",
                fill: "none"
              }} viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
              </svg>
              <input
                type="text"
                value={searchPhone}
                onChange={(event) => setSearchPhone(event.target.value)}
                placeholder="Search or start a new chat"
                style={{
                  border: "none",
                  background: "transparent",
                  fontSize: "13px",
                  outline: "none",
                  width: "100%",
                  color: "var(--t1)"
                }}
              />
            </div>
          </div>

          {/* Filter Chips */}
          <div style={{
            display: "flex",
            gap: "6px",
            padding: "12px 12px 8px",
            overflowX: "auto",
            flexShrink: 0,
            fontSize: "13px"
          }}>
            <button
              type="button"
              onClick={() => setActiveFilter("all")}
              style={{
                padding: "6px 16px",
                borderRadius: "16px",
                border: activeFilter === "all" ? "none" : "1px solid var(--div)",
                background: activeFilter === "all" ? "#d9f5f0" : "transparent",
                color: activeFilter === "all" ? "var(--g)" : "var(--t1)",
                cursor: "pointer",
                fontWeight: activeFilter === "all" ? 600 : 500,
                fontSize: "13px",
                whiteSpace: "nowrap",
                transition: "all 0.15s"
              }}
              onMouseEnter={(e) => {
                if (activeFilter !== "all") {
                  e.currentTarget.style.background = "var(--hov)"
                }
              }}
              onMouseLeave={(e) => {
                if (activeFilter !== "all") {
                  e.currentTarget.style.background = "transparent"
                }
              }}
            >
              All
            </button>
            
            <button
              type="button"
              onClick={() => setActiveFilter("unread")}
              style={{
                padding: "6px 16px",
                borderRadius: "16px",
                border: activeFilter === "unread" ? "none" : "1px solid var(--div)",
                background: activeFilter === "unread" ? "#d9f5f0" : "transparent",
                color: activeFilter === "unread" ? "var(--g)" : "var(--t1)",
                cursor: "pointer",
                fontWeight: activeFilter === "unread" ? 600 : 500,
                fontSize: "13px",
                whiteSpace: "nowrap",
                transition: "all 0.15s"
              }}
              onMouseEnter={(e) => {
                if (activeFilter !== "unread") {
                  e.currentTarget.style.background = "var(--hov)"
                }
              }}
              onMouseLeave={(e) => {
                if (activeFilter !== "unread") {
                  e.currentTarget.style.background = "transparent"
                }
              }}
            >
              Unread {totalUnread > 0 && totalUnread}
            </button>
            
            <button
              type="button"
              onClick={() => setActiveFilter("favorites")}
              style={{
                padding: "6px 16px",
                borderRadius: "16px",
                border: activeFilter === "favorites" ? "none" : "1px solid var(--div)",
                background: activeFilter === "favorites" ? "#d9f5f0" : "transparent",
                color: activeFilter === "favorites" ? "var(--g)" : "var(--t1)",
                cursor: "pointer",
                fontWeight: activeFilter === "favorites" ? 600 : 500,
                fontSize: "13px",
                whiteSpace: "nowrap",
                transition: "all 0.15s"
              }}
              onMouseEnter={(e) => {
                if (activeFilter !== "favorites") {
                  e.currentTarget.style.background = "var(--hov)"
                }
              }}
              onMouseLeave={(e) => {
                if (activeFilter !== "favorites") {
                  e.currentTarget.style.background = "transparent"
                }
              }}
            >
              Favourites
            </button>
            
            <button
              type="button"
              onClick={() => setActiveFilter("groups")}
              style={{
                padding: "6px 16px",
                borderRadius: "16px",
                border: activeFilter === "groups" ? "none" : "1px solid var(--div)",
                background: activeFilter === "groups" ? "#d9f5f0" : "transparent",
                color: activeFilter === "groups" ? "var(--g)" : "var(--t1)",
                cursor: "pointer",
                fontWeight: activeFilter === "groups" ? 600 : 500,
                fontSize: "13px",
                whiteSpace: "nowrap",
                transition: "all 0.15s"
              }}
              onMouseEnter={(e) => {
                if (activeFilter !== "groups") {
                  e.currentTarget.style.background = "var(--hov)"
                }
              }}
              onMouseLeave={(e) => {
                if (activeFilter !== "groups") {
                  e.currentTarget.style.background = "transparent"
                }
              }}
            >
              Groups {groupCount > 0 && groupCount}
            </button>
          </div>

          {/* Chat List */}
          <div style={{
            flex: 1,
            overflowY: "auto",
            background: "var(--panel)",
            padding: "4px 8px"
          }}>
            {isLoading ? (
              <div style={{ padding: "16px", fontSize: "14px", color: "var(--t2)" }}>Loading conversations...</div>
            ) : filteredContacts.length === 0 ? (
              <div style={{ padding: "16px", fontSize: "14px", color: "var(--t2)" }}>No conversations found.</div>
            ) : (
              filteredContacts.map((contact, index) => {
                const isActive = contact.key === selectedContactKey
                const colors = ["#31A24C", "#F58220", "#4B7BE5", "#E74C3C", "#9B59B6", "#E91E63", "#FF6F00", "#00BCD4", "#4CAF50", "#673AB7"]
                const colorIndex = index % colors.length
                
                return (
                  <button
                    key={contact.key}
                    type="button"
                    onClick={() => setSelectedContactKey(contact.key)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "8px 12px",
                      margin: "4px 0",
                      cursor: "pointer",
                      transition: "background 0.1s",
                      position: "relative",
                      width: "100%",
                      border: "none",
                      background: isActive ? "var(--hov)" : "transparent",
                      textAlign: "left",
                      borderRadius: "8px",
                      boxSizing: "border-box"
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "var(--hov)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = isActive ? "var(--hov)" : "transparent"}
                  >
                    <div style={{
                      width: "49px",
                      height: "49px",
                      borderRadius: "50%",
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: colors[colorIndex],
                      boxSizing: "border-box",
                      overflow: "hidden"
                    }}>
                      {contact.phoneNumber && messages.find(m => m.phoneNumber === contact.phoneNumber)?.profilePicture ? (
                        <img
                          src={messages.find(m => m.phoneNumber === contact.phoneNumber)?.profilePicture || ""}
                          alt={contact.senderName}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover"
                          }}
                        />
                      ) : (
                        <svg style={{ width: "28px", height: "28px", fill: "#fff" }} viewBox="0 0 24 24">
                          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                        </svg>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px", gap: "8px" }}>
                        <span style={{
                          fontSize: "16px",
                          fontWeight: 500,
                          color: "var(--t1)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          flex: 1
                        }}>{contact.senderName}</span>
                        <span style={{
                          fontSize: "12px",
                          color: "var(--t2)",
                          flexShrink: 0,
                          whiteSpace: "nowrap"
                        }}>{formatTimeOnly(contact.lastTimestamp)}</span>
                      </div>
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        marginTop: "2px"
                      }}>
                        <span style={{
                          fontSize: "13px",
                          color: "var(--t2)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          flex: 1
                        }}>{contact.preview || "No messages"}</span>
                        <div
                          onClick={(e) => {
                            e.stopPropagation()
                            setFavoriteContacts((prev) => {
                              const next = new Set(prev)
                              if (next.has(contact.key)) {
                                next.delete(contact.key)
                              } else {
                                next.add(contact.key)
                              }
                              return next
                            })
                          }}
                          style={{
                            background: "none",
                            cursor: "pointer",
                            padding: "4px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0
                          }}
                          title={favoriteContacts.has(contact.key) ? "Remove from favorites" : "Add to favorites"}
                        >
                          {favoriteContacts.has(contact.key) ? (
                            <svg style={{ width: "18px", height: "18px", fill: "#ffc107" }} viewBox="0 0 24 24">
                              <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2l-2.81 6.63L2 9.24l5.46 4.73L5.82 21z" />
                            </svg>
                          ) : (
                            <svg style={{ width: "18px", height: "18px", fill: "none", stroke: "#999", strokeWidth: "2" }} viewBox="0 0 24 24">
                              <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2l-2.81 6.63L2 9.24l5.46 4.73L5.82 21z" />
                            </svg>
                          )}
                        </div>
                        {!viewedConversations.has(contact.key) && contact.unreadCount > 0 ? (
                          <span style={{
                            background: "var(--unr)",
                            color: "#fff",
                            borderRadius: "50%",
                            fontSize: "11px",
                            fontWeight: 600,
                            width: "24px",
                            height: "24px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0
                          }}>
                            {contact.unreadCount > 99 ? "99+" : contact.unreadCount}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* RIGHT PANEL */}
        <section style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          background: "var(--chat-bg)",
          minWidth: 0,
          position: "relative"
        }}>
          {/* Background Pattern */}
          <div style={{
            content: '""',
            position: "absolute",
            inset: 0,
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Ccircle cx='40' cy='40' r='3' fill='%23b2bec3' fill-opacity='.15'/%3E%3C/svg%3E")`,
            pointerEvents: "none",
            zIndex: 0
          }} />

          {/* Messages Area */}
          <div style={{
            flex: 1,
            overflowY: "auto",
            padding: "12px 8% 8px",
            zIndex: 1,
            position: "relative",
            display: "flex",
            flexDirection: "column",
            gap: "2px"
          }}>
            {!selectedContact ? (
              <div style={{
                display: "flex",
                height: "100%",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "14px",
                color: "var(--t2)"
              }}>
                Select a conversation from the left panel.
              </div>
            ) : activeConversation.length === 0 ? (
              <div style={{
                display: "flex",
                height: "100%",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "14px",
                color: "var(--t2)"
              }}>
                No messages in this conversation.
              </div>
            ) : (
              <>
                {activeConversation.map((message, idx) => {
                  const isOutgoing = message.isOutgoing ?? false
                  const currentDayKey = getDayKey(message.timestamp)
                  const previousDayKey = idx > 0 ? getDayKey(activeConversation[idx - 1].timestamp) : null
                  const showDateSeparator = currentDayKey !== previousDayKey

                  return (
                    <div key={message.id}>
                      {showDateSeparator && (
                        <div style={{
                          display: "flex",
                          justifyContent: "center",
                          alignItems: "center",
                          margin: "16px 0 12px 0",
                          gap: "8px"
                        }}>
                          <span style={{
                            fontSize: "12px",
                            color: "var(--t2)",
                            backgroundColor: "var(--hdr)",
                            padding: "4px 12px",
                            borderRadius: "12px",
                            whiteSpace: "nowrap"
                          }}>
                            {formatDateSeparator(message.timestamp)}
                          </span>
                        </div>
                      )}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: isOutgoing ? "flex-end" : "flex-start",
                          marginBottom: "1px",
                          width: "100%"
                        }}
                      >
                        <div style={{
                          padding: "8px 12px 20px 12px",
                          borderRadius: "18px",
                          borderTopLeftRadius: isOutgoing ? "18px" : "4px",
                          borderTopRightRadius: isOutgoing ? "4px" : "18px",
                          position: "relative",
                          fontSize: "14px",
                          lineHeight: "1.4",
                          color: "var(--t1)",
                          boxShadow: "0 1px 0.5px rgba(0,0,0,.13)",
                          wordBreak: "break-word",
                          maxWidth: "65%",
                          width: "fit-content",
                          minWidth: "80px",
                          background: isOutgoing ? "var(--bub-out)" : "var(--bub-in)"
                        }}>
                          {message.content || "-"}
                          <div style={{
                            position: "absolute",
                            bottom: "3px",
                            right: "6px",
                            display: "flex",
                            alignItems: "center",
                            gap: "2px",
                            fontSize: "11px",
                            color: "var(--t2)",
                            whiteSpace: "nowrap",
                            flexShrink: 0
                          }}>
                            {formatTimeOnly(message.timestamp)}
                            <span style={{
                              fontSize: "11px",
                              color: "var(--blue)"
                            }}>✓✓</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </>
            )}
          </div>

          {/* Input Area */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 16px",
            background: "#f0f2f5",
            zIndex: 2,
            flexShrink: 0
          }}>
            <button
              type="button"
              style={{
                width: "auto",
                height: "auto",
                border: "none",
                background: "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "var(--ic)",
                padding: "8px",
                opacity: 0.6
              }}
              title="Emoji"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="10" cy="10" r="9" />
                <circle cx="7" cy="8" r="1.2" />
                <circle cx="13" cy="8" r="1.2" />
                <path d="M7 12c1.5 1 3.5 1 6 0" strokeLinecap="round" />
              </svg>
            </button>
            <button
              type="button"
              style={{
                width: "auto",
                height: "auto",
                border: "none",
                background: "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "var(--ic)",
                padding: "8px",
                opacity: 0.6
              }}
              title="Attach"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12.5 3.5L4 12c-1.4 1.4-1.4 3.7 0 5.1s3.7 1.4 5.1 0l8.5-8.5c.7-.7.7-1.8 0-2.5s-1.8-.7-2.5 0L6.6 14.1" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <div style={{
              flex: 1,
              background: "#fff",
              borderRadius: "24px",
              padding: "9px 14px",
              display: "flex",
              alignItems: "flex-start",
              gap: "8px",
              boxShadow: "0 1px 2px rgba(0,0,0,.08)",
              minHeight: "40px"
            }}>
              <textarea
                value={draftReply}
                onChange={(event) => setDraftReply(event.target.value)}
                placeholder="Type a message"
                style={{
                  border: "none",
                  outline: "none",
                  width: "100%",
                  fontSize: "14.5px",
                  color: "var(--t1)",
                  background: "transparent",
                  resize: "none",
                  fontFamily: "inherit",
                  maxHeight: "100px",
                  minHeight: "22px",
                  lineHeight: "1.4"
                }}
                rows={1}
              />
            </div>
            <button
              type="button"
              onClick={handleSendReply}
              disabled={!selectedContact || !draftReply.trim() || isSending}
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                border: "none",
                background: !selectedContact || !draftReply.trim() || isSending ? "rgba(0, 168, 132, 0.4)" : "var(--g)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: !selectedContact || !draftReply.trim() || isSending ? "not-allowed" : "pointer",
                flexShrink: 0,
                transition: "background .2s",
                color: "#fff"
              }}
              onMouseEnter={(e) => !(!selectedContact || !draftReply.trim() || isSending) && (e.currentTarget.style.background = "var(--gd)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = !(!selectedContact || !draftReply.trim() || isSending) ? "var(--g)" : "rgba(0, 168, 132, 0.4)")}
              title="Send reply"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5,3 19,12 5,21" />
              </svg>
            </button>
          </div>

          {/* Notification */}
          {sendNotification && (
            <div style={{
              padding: "8px 16px",
              background: sendNotification.type === "success" ? "#d4edda" : "#f8d7da",
              color: sendNotification.type === "success" ? "#155724" : "#721c24",
              borderTop: `1px solid ${sendNotification.type === "success" ? "#c3e6cb" : "#f5c6cb"}`,
              fontSize: "12px",
              zIndex: 2
            }}>
              {sendNotification.text}
            </div>
          )}
        </section>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </main>
  )
}

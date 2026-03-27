"use client"

import { toast as sonnerToast } from 'sonner'
import { CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react'
import * as React from 'react'

const baseCard = 'flex items-center gap-3 rounded-md border shadow-md px-4 py-3 w-full max-w-[360px] bg-white'
const successCard = `${baseCard} border-green-200 bg-green-50 text-green-800`
const dangerCard = `${baseCard} border-red-200 bg-red-50 text-red-800`

const iconCircle = 'flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm'
const successIconWrap = `${iconCircle} text-green-600 border border-green-100`
const dangerIconWrap = `${iconCircle} text-red-600 border border-red-100`

const titleClass = 'text-sm font-semibold leading-5'
const descriptionClass = 'text-sm leading-5'

function renderMessage(
  icon: React.ReactNode,
  title: React.ReactNode,
  description: React.ReactNode,
  kind: 'success' | 'danger',
) {
  const cardClass = kind === 'success' ? successCard : dangerCard
  const iconClass = kind === 'success' ? successIconWrap : dangerIconWrap

  return (
    <div className={cardClass}>
      <div className={iconClass}>{icon}</div>
      <div className="flex-1 space-y-1">
        {title && <div className={titleClass}>{title}</div>}
        {description && <div className={descriptionClass}>{description}</div>}
      </div>
    </div>
  )
}

// adapter: provide a `toast` function compatible with both sonner and the project's previous `use-toast` style
type LegacyToastPayload = { title?: string; description?: string; variant?: string }

function buildMessageFromPayload(payload: LegacyToastPayload) {
  if (!payload) return ''
  if (payload.title && payload.description) return { title: payload.title, description: payload.description }
  return { title: payload.title || payload.description || '', description: '' }
}

type ToastFunction = {
  (arg: string | React.ReactNode | LegacyToastPayload): ReturnType<typeof sonnerToast>
  show: (message: React.ReactNode) => ReturnType<typeof sonnerToast>
  info: (message: React.ReactNode) => ReturnType<typeof sonnerToast>
  success: (message: React.ReactNode) => ReturnType<typeof sonnerToast>
  error: (message: React.ReactNode) => ReturnType<typeof sonnerToast>
  warn: (message: React.ReactNode) => ReturnType<typeof sonnerToast>
  warning: (message: React.ReactNode) => ReturnType<typeof sonnerToast>
}

const toast: ToastFunction = ((arg: string | React.ReactNode | LegacyToastPayload) => {
  if (typeof arg === 'string' || React.isValidElement(arg)) {
    return sonnerToast(String(arg))
  }
  // payload object
  const result = buildMessageFromPayload(arg as LegacyToastPayload)
  if (typeof result === 'string') {
    return sonnerToast(result)
  }
  const { title, description } = result
  const variant = ((arg as LegacyToastPayload) && (arg as LegacyToastPayload).variant) || ''
  if (variant === 'destructive' || variant === 'error')
    return sonnerToast.error(renderMessage(<XCircle className="h-5 w-5" />, title, description, 'danger'))
  if (variant === 'success')
    return sonnerToast.success(renderMessage(<CheckCircle className="h-5 w-5" />, title, description, 'success'))
  if (variant === 'warning' || variant === 'warn')
    return sonnerToast(renderMessage(<AlertTriangle className="h-5 w-5" />, title, description, 'danger'))
  return sonnerToast(renderMessage(<Info className="h-5 w-5" />, title, description, 'success'))
}) as ToastFunction

const notify = {
  show: (message: React.ReactNode) => sonnerToast(String(message)),
  info: (message: React.ReactNode) =>
    sonnerToast(renderMessage(<Info className="h-5 w-5" />, message, '', 'success')),
  success: (message: React.ReactNode) =>
    sonnerToast.success(renderMessage(<CheckCircle className="h-5 w-5" />, message, '', 'success')),
  error: (message: React.ReactNode) =>
    sonnerToast.error(renderMessage(<XCircle className="h-5 w-5" />, message, '', 'danger')),
  warn: (message: React.ReactNode) =>
    sonnerToast(renderMessage(<AlertTriangle className="h-5 w-5" />, message, '', 'danger')),
}
// export a `toast` symbol so files can keep using the `toast` identifier
// Attach legacy-style methods to the `toast` function so callers can use
// both `toast(payload)` and `toast.error(...)` / `toast.success(...)`.
;(toast as any).show = notify.show
;(toast as any).info = notify.info
;(toast as any).success = notify.success
;(toast as any).error = notify.error
;(toast as any).warn = notify.warn
;(toast as any).warning = notify.warn

export { toast, notify }
export const show = notify.show
export const success = notify.success
export const error = notify.error
export const info = notify.info
export const warn = notify.warn

export default notify

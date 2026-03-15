/**
 * Global configuration constants for the Garage Management System
 */

// Shop Code - Can be updated in one place for use across the app
export const SHOP_CODE = process.env.NEXT_PUBLIC_SHOP_CODE || "AL"

// JobCard Statuses
export const JOB_CARD_STATUSES = [
  "Under Service",
  "Completed",
  "Pending",
  "On Hold",
] as const

export type JobCardStatus = (typeof JOB_CARD_STATUSES)[number]

export const MAINTENANCE_TYPES = [
  "Oil Change",
  "Filters",
  "General Maint.",
] as const
export type MaintenanceType = (typeof MAINTENANCE_TYPES)[number]

// Payment Statuses
export const PAYMENT_STATUSES = ["Pending", "Partial", "Completed"] as const
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

// Service Types
export const SERVICE_TYPES = [
  "Electrical",
  "AC",
  "Mechanical",
  "Others",
] as const
export type ServiceType = (typeof SERVICE_TYPES)[number]

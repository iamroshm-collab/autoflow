/**
 * Global Configuration for Garage Management App
 * This file contains all configurable settings used across the application
 */

export const CONFIG = {
  // Shop Configuration
  SHOP: {
    // Shop Code used in JobCard numbering format: JC-[ShopCode]-[Year]-[Sequence]
    CODE: 'AL', // Abbreviation: AL (Automobile Legends), customize as needed
    NAME: 'Automobile Legends',
    ADDRESS: 'Your Shop Address',
    PHONE: '+91 XXXXXXXXXX',
    GSTIN: 'XXXXXXXXXXXXXXXXXX',
  },

  // JobCard Configuration
  JOBCARD: {
    DEFAULT_STATUS: 'Under Service',
    PAYMENT_STATUS_OPTIONS: ['Pending', 'Partial', 'Paid'],
    VEHICLE_STATUS_OPTIONS: ['Available', 'Under Service', 'Pending Delivery'],
    SERVICE_TYPES: ['Mechanical', 'Electrical', 'AC', 'Others'],
  },

  // Inventory & POS Configuration
  INVENTORY: {
    TAX: {
      DEFAULT_SGST_RATE: 9,
      DEFAULT_CGST_RATE: 9,
      DEFAULT_IGST_RATE: 18,
    },
    STOCK_WARNING_THRESHOLD: 10, // Show warning when stock falls below this
    BILL_PREFIX: 'BILL',
    PURCHASE_PREFIX: 'PUR',
  },

  // Database Settings
  DATABASE: {
    // Using SQLite for local development
    PROVIDER: 'sqlite',
    // Production can be configured to use PostgreSQL or MySQL
  },

  // API Configuration
  API: {
    TIMEOUT: 30000, // 30 seconds
    BASE_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  },

  // UI Configuration
  UI: {
    // Theme colors for "under service" status
    THEME_COLORS: {
      PRIMARY: '#3b82f6', // Blue
      SECONDARY: '#64748b', // Slate
      SUCCESS: '#10b981', // Green
      WARNING: '#f59e0b', // Amber
      DANGER: '#ef4444', // Red
    },
    // Date format
    DATE_FORMAT: 'dd-mm-yy',
    CURRENCY: 'INR',
    CURRENCY_SYMBOL: '₹',
  },

  // Pagination Settings
  PAGINATION: {
    DEFAULT_PAGE_SIZE: 10,
    MAX_PAGE_SIZE: 100,
  },
}

/**
 * Generate JobCard Number with format: JC-[ShopCode]-[Year]-[Sequence]
 * @param sequence - Sequential number for that year
 * @returns Formatted JobCard number
 */
export function generateJobCardNumber(sequence: number): string {
  const year = new Date().getFullYear()
  const paddedSequence = String(sequence).padStart(4, '0')
  return `JC-${CONFIG.SHOP.CODE}-${year}-${paddedSequence}`
}

/**
 * Generate Bill Number with format: BILL-[Timestamp]
 * @returns Formatted Bill number
 */
export function generateBillNumber(): string {
  const timestamp = Date.now()
  return `${CONFIG.INVENTORY.BILL_PREFIX}-${timestamp}`
}

/**
 * Get payment status color for UI display
 */
export function getPaymentStatusColor(status: string) {
  switch (status.toLowerCase()) {
    case 'paid':
      return 'bg-green-100 text-green-800'
    case 'partial':
      return 'bg-yellow-100 text-yellow-800'
    case 'pending':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
  return `${CONFIG.UI.CURRENCY_SYMBOL}${amount.toFixed(2)}`
}

export default CONFIG

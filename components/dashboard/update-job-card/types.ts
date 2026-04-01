export interface SparePartRow {
  id: string
  shopName: string
  billDate: string
  billNumber: string
  item: string
  amount: number
  paid?: number
  paidDate?: string
  isReturn: boolean
  returnDate: string
  returnAmount: number
}

export interface SparePartReturnRow {
  id: string
  billNumber: string
  returnedItem: string
  returnDate: string
  returnAmount: number
}

export interface ServiceRow {
  id: string
  description: string
  unit: string
  quantity: number
  amount: number
  discountRate?: number
  discountAmount?: number
  cgstRate?: number
  cgstAmount?: number
  sgstRate?: number
  sgstAmount?: number
  igstRate?: number
  igstAmount?: number
  totalAmount?: number
  stateId?: string
}

export interface TechnicianRow {
  id: string
  employeeName: string
  taskAssigned: string
  allocationAmount: number
}

export interface FinancialTransactionRow {
  id: string
  transactionType: string
  transactionDate: string
  paymentType: string
  applyTo: string
  transactionAmount: number
  description: string
}

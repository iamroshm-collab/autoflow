import jsPDF from "jspdf"
import "jspdf-autotable"

interface ShopSettings {
  shopName: string
  address?: string | null
  city?: string | null
  state?: string | null
  pincode?: string | null
  phone1?: string | null
  phone2?: string | null
}

interface SimpleSlipData {
  employeeName: string
  employeeId: string
  designation: string
  month: number
  year: number
  salaryPerDay: number
  totalPresent: number
  totalHalfDay: number
  totalLeave: number
  totalAbsent: number
  basicSalary: number
  allowances: number
  incentives: number
  deductions: number
  netSalary: number
  shopSettings: ShopSettings
}

const getMonthName = (month: number): string => {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ]
  return months[month - 1] || ""
}

const formatCurrency = (amount: number): string => {
  // Use ASCII-only output (avoid the ¥/₹ Unicode symbol which breaks built-in PDF fonts).
  // Prefix with 'Rs' and format the number using en-IN grouping.
  const formatted = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
  return `Rs ${formatted}`
}

const numberToWords = (num: number): string => {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"]
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]
  const teens = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"]

  if (num === 0) return "Zero"
  if (num < 0) return "Minus " + numberToWords(Math.abs(num))

  let words = ""

  if (Math.floor(num / 10000000) > 0) {
    words += numberToWords(Math.floor(num / 10000000)) + " Crore "
    num %= 10000000
  }

  if (Math.floor(num / 100000) > 0) {
    words += numberToWords(Math.floor(num / 100000)) + " Lakh "
    num %= 100000
  }

  if (Math.floor(num / 1000) > 0) {
    words += numberToWords(Math.floor(num / 1000)) + " Thousand "
    num %= 1000
  }

  if (Math.floor(num / 100) > 0) {
    words += numberToWords(Math.floor(num / 100)) + " Hundred "
    num %= 100
  }

  if (num > 0) {
    if (num < 10) words += ones[num]
    else if (num >= 10 && num < 20) words += teens[num - 10]
    else {
      words += tens[Math.floor(num / 10)]
      if (num % 10 > 0) words += " " + ones[num % 10]
    }
  }

  return words.trim()
}

// New simplified interface for attendance-payroll module
export async function generateSalarySlipPdf(data: SimpleSlipData) {
  const doc = new jsPDF("p", "mm", "a4")
  const pageWidth = doc.internal.pageSize.getWidth()

  const monthName = getMonthName(data.month)

  // Simple currency formatter using INR prefix (internationally recognized, no special fonts needed)
  const pdfFormatCurrency = (amount: number) => {
    const num = amount.toFixed(2)
    return `INR ${num}`
  }

  // Build address line
  const addressParts: string[] = []
  if (data.shopSettings.address) addressParts.push(data.shopSettings.address)
  if (data.shopSettings.city) addressParts.push(data.shopSettings.city)
  if (data.shopSettings.state) addressParts.push(data.shopSettings.state)
  if (data.shopSettings.pincode) addressParts.push(data.shopSettings.pincode)
  const addressLine = addressParts.join(", ") || ""

  // Build phone line
  const phoneParts: string[] = []
  if (data.shopSettings.phone1) phoneParts.push(data.shopSettings.phone1)
  if (data.shopSettings.phone2) phoneParts.push(data.shopSettings.phone2)
  const phoneLine = phoneParts.length > 0 ? `Ph: ${phoneParts.join(", ")}` : ""

  // Header
  doc.setFillColor(52, 73, 94)
  doc.rect(0, 0, 210, 40, "F")

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(24)
  doc.setFont("helvetica", "bold")
  doc.text("SALARY SLIP", pageWidth / 2, 15, { align: "center" })

  doc.setFontSize(12)
  doc.setFont("helvetica", "normal")
  doc.text(data.shopSettings.shopName || "AUTO GARAGE", pageWidth / 2, 23, { align: "center" })
  if (addressLine) {
    doc.text(addressLine, pageWidth / 2, 30, { align: "center" })
  }
  if (phoneLine) {
    doc.text(phoneLine, pageWidth / 2, addressLine ? 36 : 30, { align: "center" })
  }

  // Reset text color
  doc.setTextColor(0, 0, 0)

  // Pay Period
  doc.setFontSize(14)
  doc.setFont("helvetica", "bold")
  doc.text(`Pay Period: ${monthName} ${data.year}`, pageWidth / 2, 50, { align: "center" })

  // Employee Details Box
  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)

  const startY = 60
  doc.setDrawColor(52, 73, 94)
  doc.setLineWidth(0.5)
  doc.rect(15, startY, 180, 25)

  doc.setFont("helvetica", "bold")
  doc.text("Employee Details:", 20, startY + 7)

  doc.setFont("helvetica", "normal")
  doc.text(`Name: ${data.employeeName}`, 20, startY + 13)
  doc.text(`Employee ID: ${data.employeeId}`, 20, startY + 19)

  doc.text(`Designation: ${data.designation}`, 110, startY + 13)
  doc.text(`Salary/Day: ${pdfFormatCurrency(data.salaryPerDay)}`, 110, startY + 19)

  // Attendance Summary
  const attendanceY = startY + 35
  doc.setFont("helvetica", "bold")
  doc.setFontSize(12)
  doc.text("Attendance Summary", 20, attendanceY)

  const attendanceData = [
    ["Present (P)", data.totalPresent.toString(), "Full Pay"],
    ["Half Day (H)", data.totalHalfDay.toString(), "Half Pay"],
    ["Leave (L)", data.totalLeave.toString(), "Full Pay"],
    ["Absent (A)", data.totalAbsent.toString(), "No Pay"],
  ]

  // helper to ensure jspdf-autotable is available regardless of bundler behavior
  const callAutoTable = async (opts: any) => {
    // prefer method attached to doc
    if (typeof (doc as any).autoTable === "function") {
      return (doc as any).autoTable(opts)
    }

    // otherwise try dynamic import and call exported function
    try {
      const mod = await import(/* webpackChunkName: "jspdf-autotable" */ "jspdf-autotable")
      const fn = (mod && (mod.default || mod.autoTable)) as any
      if (typeof fn === "function") {
        return fn(doc, opts)
      }
    } catch (err) {
      console.warn("[generateSalarySlipPdf] dynamic import jspdf-autotable failed:", err)
    }

    throw new Error("jspdf-autotable plugin unavailable")
  }

  await callAutoTable({
    startY: attendanceY + 5,
    head: [["Type", "Days", "Pay Status"]],
    body: attendanceData,
    theme: "grid",
    headStyles: {
      fillColor: [52, 73, 94],
      textColor: [255, 255, 255],
      fontSize: 10,
      fontStyle: "bold",
    },
    bodyStyles: {
      fontSize: 9,
    },
    margin: { left: 20, right: 20 },
    tableWidth: 170,
  })

  // Earnings and Deductions
  const earningsY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 15 : attendanceY + 60

  doc.setFont("helvetica", "bold")
  doc.setFontSize(12)
  doc.text("Earnings", 20, earningsY)
  doc.text("Deductions", 110, earningsY)

  const earningsData = [
    ["Basic Salary", pdfFormatCurrency(data.basicSalary)],
    ["Allowances", pdfFormatCurrency(data.allowances)],
    ["Incentives", pdfFormatCurrency(data.incentives)],
  ]

  const deductionsData = [["Advances", pdfFormatCurrency(data.deductions)]]

  // Earnings Table
  await callAutoTable({
    startY: earningsY + 5,
    body: earningsData,
    theme: "plain",
    bodyStyles: {
      fontSize: 10,
    },
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 25, halign: "right", fontStyle: "bold" },
    },
    margin: { left: 20 },
  })

  // Deductions Table
  await callAutoTable({
    startY: earningsY + 5,
    body: deductionsData,
    theme: "plain",
    bodyStyles: {
      fontSize: 10,
    },
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 25, halign: "right", fontStyle: "bold" },
    },
    margin: { left: 110 },
  })

  // Calculate totals
  const totalEarnings = data.basicSalary + data.allowances + data.incentives
  const totalDeductions = data.deductions

  // Totals line
  const totalsY = Math.max(
    (doc as any).lastAutoTable.finalY,
    earningsY + 5 + earningsData.length * 7
  )

  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.3)
  doc.line(20, totalsY + 2, 105, totalsY + 2)
  doc.line(110, totalsY + 2, 195, totalsY + 2)

  doc.setFont("helvetica", "bold")
  doc.text("Total Earnings:", 20, totalsY + 8)
  doc.text(pdfFormatCurrency(totalEarnings), 105, totalsY + 8, { align: "right" })

  doc.text("Total Deductions:", 110, totalsY + 8)
  doc.text(pdfFormatCurrency(totalDeductions), 195, totalsY + 8, { align: "right" })

  // Net Salary Box
  const netSalaryY = totalsY + 18

  doc.setFillColor(52, 73, 94)
  doc.rect(15, netSalaryY, 180, 15, "F")

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.setFont("helvetica", "bold")
  doc.text("NET PAYABLE:", 20, netSalaryY + 10)
  doc.text(pdfFormatCurrency(data.netSalary), 195, netSalaryY + 10, { align: "right" })

  // Amount in Words
  doc.setTextColor(0, 0, 0)
  doc.setFont("helvetica", "italic")
  doc.setFontSize(10)
  const amountInWords = numberToWords(Math.floor(data.netSalary))
  doc.text(`Amount in Words: ${amountInWords} Rupees Only`, 20, netSalaryY + 22, {
    maxWidth: 170,
  })

  // Footer
  const footerY = 270
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)

  doc.text("This is a computer-generated salary slip and does not require a signature.", pageWidth / 2, footerY, {
    align: "center",
  })

  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.2)
  doc.line(20, footerY - 10, 95, footerY - 10)
  doc.line(115, footerY - 10, 190, footerY - 10)

  doc.setFontSize(8)
  doc.text("Employee Signature", 57.5, footerY - 5, { align: "center" })
  doc.text("Authorized Signatory", 152.5, footerY - 5, { align: "center" })

  // Print the PDF
  try {
    // autoPrint is not guaranteed to exist; call only when available
    if (typeof (doc as any).autoPrint === "function") {
      try {
        ;(doc as any).autoPrint()
      } catch (err) {
        console.warn("[generateSalarySlipPdf] autoPrint() failed:", err)
      }
    }

    // Prefer blob URL; if not available use blob fallback
    let url: string | null = null
    try {
      if (typeof doc.output === "function") {
        url = doc.output("bloburl") as string
      }
    } catch (err) {
      console.warn("[generateSalarySlipPdf] doc.output('bloburl') failed:", err)
    }

    if (!url) {
      const blob = doc.output("blob") as Blob
      url = URL.createObjectURL(blob)
    }

    window.open(url, "_blank")
  } catch (err) {
    console.error("[generateSalarySlipPdf] failed to open PDF:", err)
    throw err
  }
}

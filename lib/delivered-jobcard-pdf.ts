import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import QRCode from "qrcode"

export interface ShopSettings {
  shopName: string
  address?: string | null
  city?: string | null
  state?: string | null
  pincode?: string | null
  phone1?: string | null
  phone2?: string | null
  email?: string | null
  gstin?: string | null
  website?: string | null
  upiId?: string | null
}

export interface DeliveredInvoiceServiceRow {
  description: string
  quantity: number
  unit: string
  amount: number
  discountRate?: number
  discountAmount?: number
  salePrice?: number
  sgstRate?: number
  sgstAmount?: number
  cgstRate?: number
  cgstAmount?: number
  igstRate?: number
  igstAmount?: number
}

export interface DeliveredInvoiceSparePartRow {
  item: string
  billNumber?: string
  amount: number
}

export interface DeliveredInvoicePayload {
  jobCardNumber: string
  serviceId: string
  customerName: string
  customerMobile: string
  registrationNumber: string
  vehicleModel: string
  kmDriven: string
  deliveryDate: string
  nextServiceDate: string
  nextServiceKM: string
  total: number
  discount: number
  advance: number
  grandTotal: number
  paidAmount: number
  balance: number
  services: DeliveredInvoiceServiceRow[]
  spareParts?: DeliveredInvoiceSparePartRow[]
  shopSettings: ShopSettings
}

export const amountToWords = (amount: number) => {
  const units = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"]
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]

  const twoDigits = (num: number) => {
    if (num < 20) return units[num]
    const ten = Math.floor(num / 10)
    const unit = num % 10
    return `${tens[ten]}${unit ? ` ${units[unit]}` : ""}`.trim()
  }

  const threeDigits = (num: number) => {
    const hundred = Math.floor(num / 100)
    const remainder = num % 100
    let result = ""
    if (hundred > 0) result += `${units[hundred]} Hundred`
    if (remainder > 0) result += `${result ? " " : ""}${twoDigits(remainder)}`
    return result.trim()
  }

  const integer = Math.floor(Math.max(amount, 0))
  if (integer === 0) return "Rupees Zero Only"

  const crore = Math.floor(integer / 10000000)
  const lakh = Math.floor((integer % 10000000) / 100000)
  const thousand = Math.floor((integer % 100000) / 1000)
  const hundred = integer % 1000

  const parts: string[] = []
  if (crore) parts.push(`${threeDigits(crore)} Crore`)
  if (lakh) parts.push(`${threeDigits(lakh)} Lakh`)
  if (thousand) parts.push(`${threeDigits(thousand)} Thousand`)
  if (hundred) parts.push(threeDigits(hundred))

  return `Rupees ${parts.join(" ")} Only`
}

const toDisplayDate = (value: string) => {
  if (!value) return "-"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("en-GB")
}

const isValidUpiId = (value?: string | null) => {
  if (!value) return false
  const upiId = value.trim()
  return /^[a-zA-Z0-9._-]{2,}@[a-zA-Z]{2,}$/.test(upiId)
}

export async function generateDeliveredJobCardPdf(payload: DeliveredInvoicePayload) {
  const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
  const leftX = 14;
  const rightX = 196;

  // Build address line
  const addressParts: string[] = []
  if (payload.shopSettings.address) addressParts.push(payload.shopSettings.address)
  if (payload.shopSettings.city) addressParts.push(payload.shopSettings.city)
  if (payload.shopSettings.state) addressParts.push(payload.shopSettings.state)
  if (payload.shopSettings.pincode) addressParts.push(payload.shopSettings.pincode)
  const addressLine = addressParts.join(", ") || ""

  // Build phone line
  const phoneParts: string[] = []
  if (payload.shopSettings.phone1) phoneParts.push(payload.shopSettings.phone1)
  if (payload.shopSettings.phone2) phoneParts.push(payload.shopSettings.phone2)
  const phoneLine = phoneParts.length > 0 ? `Phone: ${phoneParts.join(", ")}` : ""

  // --- Header ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(payload.shopSettings.shopName || "AUTO GARAGE", 105, 15, { align: "center" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  if (addressLine) doc.text(addressLine, 105, 20, { align: "center" });
  if (phoneLine) doc.text(phoneLine, 105, addressLine ? 24 : 20, { align: "center" });

  // --- Info Section ---
  doc.setFontSize(9);
  const infoTopY = 32;
  const lineGap = 5;
  const vehicleText = payload.registrationNumber || "-";

  doc.setFont("helvetica", "bold");
  doc.text("Customer:", leftX, infoTopY);
  doc.text("Mobile:", leftX, infoTopY + lineGap);
  doc.text("Jobcard:", leftX, infoTopY + lineGap * 2);
  doc.text("Vehicle:", rightX - 54, infoTopY);
  doc.text("KM Driven:", rightX - 54, infoTopY + lineGap);
  doc.text("Delivery Date:", rightX - 54, infoTopY + lineGap * 2);

  doc.setFont("helvetica", "normal");
  doc.text(payload.customerName || "-", leftX + 18, infoTopY);
  doc.text(payload.customerMobile || "-", leftX + 18, infoTopY + lineGap);
  doc.text(payload.jobCardNumber || "-", leftX + 18, infoTopY + lineGap * 2);
  doc.text(vehicleText, rightX, infoTopY, { align: "right" });
  doc.text(payload.kmDriven || "-", rightX, infoTopY + lineGap, { align: "right" });
  doc.text(toDisplayDate(payload.deliveryDate), rightX, infoTopY + lineGap * 2, { align: "right" });

  // --- 1. SPARE PARTS TABLE ---
  // Place ESTIMATE one line below Delivery Date and shift tables down
  const tableHeadingY = infoTopY + lineGap * 3;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("ESTIMATE", 105, tableHeadingY, { align: "center" });
  doc.setFontSize(11);
  doc.text("Spare Parts", 105, tableHeadingY + 10, { align: "center" });

  const spareParts = (payload.spareParts || []).map(sp => ({
    description: `${sp.item || "Spare Part"}${sp.billNumber ? ` (Bill: ${sp.billNumber})` : ""}`,
    total: Number(sp.amount || 0),
  })).filter(p => p.total > 0)

  const partsBody: Array<Array<string>> = [];
  let partIndex = 1;
  spareParts.forEach(p => { partsBody.push([String(partIndex++), p.description, p.total.toFixed(1)]); });

  const partsTotal = spareParts.reduce((acc, curr) => acc + curr.total, 0);

  autoTable(doc, {
    startY: tableHeadingY + 15,
    head: [['S.No', 'Description', 'Amount']],
    body: partsBody,
    theme: 'plain',
    headStyles: { fontStyle: 'bold', textColor: [0, 0, 0], halign: 'center' },
    tableWidth: 182,
    columnStyles: {
      0: { cellWidth: 10, halign: 'center', overflow: 'ellipsize' },
      1: { cellWidth: 'auto', overflow: 'linebreak', halign: 'left' },
      2: { cellWidth: 18, halign: 'center', overflow: 'ellipsize' }
    },
    styles: { fontSize: 9, cellPadding: 1.4 },
    didDrawCell: (data) => {
      const { doc, cell, section, column, row } = data;
      doc.setDrawColor(180);
      doc.setLineWidth(0.3);
      // Vertical lines for every cell
      doc.line(cell.x, cell.y, cell.x, cell.y + cell.height);
      if (column.index === data.table.columns.length - 1) {
        doc.line(cell.x + cell.width, cell.y, cell.x + cell.width, cell.y + cell.height);
      }
      // Top line for header only
      if (section === 'head') doc.line(cell.x, cell.y, cell.x + cell.width, cell.y);
      // Bottom line for header and the very last row of body
      const isLastRow = row.index === data.table.body.length - 1;
      if (section === 'head' || (section === 'body' && isLastRow)) {
        doc.line(cell.x, cell.y + cell.height, cell.x + cell.width, cell.y + cell.height);
      }
    }
  });

  // Add a total row below the spare parts table
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 2,
    margin: { left: 130 },
    body: [["Total:", partsTotal.toFixed(1)]],
    theme: 'plain',
    styles: { fontSize: 10, halign: 'right' },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 30 }, 1: { cellWidth: 36 } }
  });

  let currentY = (doc as any).lastAutoTable.finalY + 4;

  // --- 2. SERVICE DESCRIPTION TABLE ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Service Description", 105, currentY, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  const labors = payload.services;
  
  // Detect taxable usage from service rows
  const taxableEnabled = labors.some(s => Number((s as any).sgstRate || 0) > 0 || Number((s as any).cgstRate || 0) > 0 || Number((s as any).igstRate || 0) > 0);
  const globalDiscount = Number(payload.discount || 0);

  const distributedGlobalDiscounts = (() => {
    if (!taxableEnabled || labors.length === 0 || globalDiscount <= 0) {
      return labors.map(() => 0)
    }

    const bases = labors.map((l) => Math.max(Number(l.amount || 0), 0))
    const totalBase = bases.reduce((sum, value) => sum + value, 0)

    if (totalBase <= 0) {
      const equalShare = globalDiscount / labors.length
      return labors.map(() => equalShare)
    }

    const rawShares = bases.map((base) => (globalDiscount * base) / totalBase)
    const distributedTotal = rawShares.reduce((sum, value) => sum + value, 0)
    const remainder = globalDiscount - distributedTotal

    if (Math.abs(remainder) <= 1e-9) {
      return rawShares
    }

    const maxBaseIndex = bases.reduce((maxIdx, value, idx, arr) =>
      value > arr[maxIdx] ? idx : maxIdx,
    0)
    rawShares[maxBaseIndex] += remainder
    return rawShares
  })()

  let laborBody: Array<Array<string>> = [];
  
  if (taxableEnabled) {
    // For taxable: show Unit, Rate, Disc%, Disc Amount, Tax, and Total Amount
    laborBody = labors.map((l, idx) => {
        const ownDiscount = Number(l.discountAmount || 0);
        const allocatedGlobalDiscount = Number(distributedGlobalDiscounts[idx] || 0)
        const discountAmt = ownDiscount + allocatedGlobalDiscount;
        const grossAmountForRate = l.amount + discountAmt;
        const rate = grossAmountForRate / l.quantity;
        const discountPct = grossAmountForRate > 0 ? (discountAmt / grossAmountForRate) * 100 : 0;
      const sgstRate = Number(l.sgstRate || 0);
      const cgstRate = Number(l.cgstRate || 0);
      const igstRate = Number(l.igstRate || 0);
      const taxRate = sgstRate + cgstRate + igstRate;
      
      return [
        (idx + 1).toString(),
        l.description,
        l.unit || "1",
        rate.toFixed(1),
        l.quantity.toString(),
        discountPct.toFixed(1),
        discountAmt.toFixed(1),
        taxRate.toFixed(1),
        l.amount.toFixed(1)
      ]
    });

    autoTable(doc, {
      startY: currentY + 6,
      head: [['S.No', 'Description', 'Unit', 'Rate', 'Qty', 'Disc%', 'Disc Amt', 'Tax%', 'Amount']],
      body: laborBody,
      theme: 'plain',
      headStyles: { fontStyle: 'bold', textColor: [0, 0, 0], halign: 'center' },
      tableWidth: 182,
      columnStyles: {
        0: { cellWidth: 10, halign: 'center', overflow: 'ellipsize' },
        1: { cellWidth: 'auto', overflow: 'linebreak', halign: 'left' },
        2: { cellWidth: 10, halign: 'center', overflow: 'ellipsize' },
        3: { cellWidth: 18, halign: 'center', overflow: 'ellipsize' },
        4: { cellWidth: 10, halign: 'center', overflow: 'ellipsize' },
        5: { cellWidth: 12, halign: 'center', overflow: 'ellipsize' },
        6: { cellWidth: 14, halign: 'center', overflow: 'ellipsize' },
        7: { cellWidth: 12, halign: 'center', overflow: 'ellipsize' },
        8: { cellWidth: 18, halign: 'center', overflow: 'ellipsize' }
      },
      styles: { fontSize: 9, cellPadding: 1.4 },
      didDrawCell: (data) => {
        const { doc, cell, section, column, row } = data;
        doc.setDrawColor(180);
        doc.setLineWidth(0.3);
        doc.line(cell.x, cell.y, cell.x, cell.y + cell.height);
        if (column.index === data.table.columns.length - 1) {
          doc.line(cell.x + cell.width, cell.y, cell.x + cell.width, cell.y + cell.height);
        }
        if (section === 'head') doc.line(cell.x, cell.y, cell.x + cell.width, cell.y);
        const isLastRow = row.index === data.table.body.length - 1;
        if (section === 'head' || (section === 'body' && isLastRow)) {
          doc.line(cell.x, cell.y + cell.height, cell.x + cell.width, cell.y + cell.height);
        }
      }
    });
  } else {
    // For non-taxable: show Unit, Rate, Qty, and Amount
    laborBody = labors.map((l, idx) => {
      const rate = (l.amount + (l.discountAmount || 0)) / l.quantity;
      
      return [
        (idx + 1).toString(),
        l.description,
        l.unit || "1",
        rate.toFixed(1),
        l.quantity.toString(),
        l.amount.toFixed(1)
      ]
    });

    autoTable(doc, {
      startY: currentY + 6,
      head: [['S.No', 'Description', 'Unit', 'Rate', 'Qty', 'Amount']],
      body: laborBody,
      theme: 'plain',
      headStyles: { fontStyle: 'bold', textColor: [0, 0, 0], halign: 'center' },
      tableWidth: 182,
      columnStyles: {
        0: { cellWidth: 10, halign: 'center', overflow: 'ellipsize' },
        1: { cellWidth: 'auto', overflow: 'linebreak', halign: 'left' },
        2: { cellWidth: 10, halign: 'center', overflow: 'ellipsize' },
        3: { cellWidth: 18, halign: 'center', overflow: 'ellipsize' },
        4: { cellWidth: 10, halign: 'center', overflow: 'ellipsize' },
        5: { cellWidth: 18, halign: 'center', overflow: 'ellipsize' }
      },
      styles: { fontSize: 9, cellPadding: 1.4 },
      didDrawCell: (data) => {
        const { doc, cell, section, column, row } = data;
        doc.setDrawColor(180);
        doc.setLineWidth(0.3);
        doc.line(cell.x, cell.y, cell.x, cell.y + cell.height);
        if (column.index === data.table.columns.length - 1) {
          doc.line(cell.x + cell.width, cell.y, cell.x + cell.width, cell.y + cell.height);
        }
        if (section === 'head') doc.line(cell.x, cell.y, cell.x + cell.width, cell.y);
        const isLastRow = row.index === data.table.body.length - 1;
        if (section === 'head' || (section === 'body' && isLastRow)) {
          doc.line(cell.x, cell.y + cell.height, cell.x + cell.width, cell.y + cell.height);
        }
      }
    });
  }

  // Add a total row below the service description table
  const laborTotal = labors.reduce((acc, curr) => acc + curr.amount, 0);
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 2,
    margin: { left: 130 },
    body: [["Total:", laborTotal.toFixed(1)]],
    theme: 'plain',
    styles: { fontSize: 10, halign: 'right' },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 30 }, 1: { cellWidth: 36 } }
  });

  // draw a full-width rule below the service total and bring summary up close
  const totalLineY = (doc as any).lastAutoTable.finalY + 3;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.line(leftX, totalLineY, rightX, totalLineY);

  // --- Summary & Footer ---
  currentY = totalLineY + 3;
  const totalParts = (payload.spareParts || []).reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
  const totalLabor = labors.reduce((acc, curr) => acc + curr.amount, 0);

  // Calculate tax amounts from service rows
  const totalSgst = labors.reduce((acc, s) => acc + Number(s.sgstAmount || 0), 0);
  const totalCgst = labors.reduce((acc, s) => acc + Number(s.cgstAmount || 0), 0);
  const totalIgst = labors.reduce((acc, s) => acc + Number(s.igstAmount || 0), 0);

  const billTotal = totalLabor + totalParts;
  const discount = Number(payload.discount || 0);
  const advance = Number(payload.advance || 0);
  const netPayable = !taxableEnabled
    ? billTotal - discount - advance
    : billTotal - discount - advance + totalSgst + totalCgst + totalIgst

  const summaryRows: Array<[string, string]> = [];
  summaryRows.push(["Gross Amount:", billTotal.toFixed(1)]);

  if (!taxableEnabled) {
    summaryRows.push(["Discount:", discount.toFixed(1)]);
    summaryRows.push(["Advance:", advance.toFixed(1)]);
    summaryRows.push(["Net Payable:", netPayable.toFixed(1)]);
  } else {
    summaryRows.push(["Discount:", discount.toFixed(1)]);
    summaryRows.push(["Advance:", advance.toFixed(1)]);
    summaryRows.push(["SGST:", totalSgst.toFixed(1)]);
    summaryRows.push(["CGST:", totalCgst.toFixed(1)]);
    summaryRows.push(["IGST:", totalIgst.toFixed(1)]);
    summaryRows.push(["Net Payable:", netPayable.toFixed(1)]);
  }

  autoTable(doc, {
    startY: currentY,
    margin: { left: 130 },
    body: summaryRows,
    theme: 'plain',
    styles: { fontSize: 10, halign: 'right' },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 30 }, 1: { cellWidth: 36 } }
  });

  // Position amount box aligned with the first row (Gross Amount) of the summary table
  const amountBoxY = currentY + 5;
  doc.setFont("helvetica", "bold");
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  const amountInWords = amountToWords(netPayable);
  doc.text(amountInWords, leftX, amountBoxY, { maxWidth: 100 });

  // If odo (km driven) is provided, compute next service as 1 year after delivery
  // and next service km as odo + 10000. Otherwise use provided values.
  const odoValue = Number(payload.kmDriven || 0);
  let displayNextServiceDate = toDisplayDate(payload.nextServiceDate);
  let displayNextServiceKM = payload.nextServiceKM || "";

  if (odoValue > 0) {
    // compute 1 year after delivery date
    if (payload.deliveryDate) {
      const d = new Date(payload.deliveryDate)
      if (!Number.isNaN(d.getTime())) {
        const nextDate = new Date(d)
        nextDate.setFullYear(nextDate.getFullYear() + 1)
        displayNextServiceDate = nextDate.toLocaleDateString("en-GB")
      }
    }
    displayNextServiceKM = String(Math.round(odoValue + 10000))
  }

  if (odoValue > 0) {
    doc.setTextColor(255, 0, 0);
    doc.setFont("helvetica", "normal");
    doc.text(`Next service for your vehicle is due on ${displayNextServiceDate}`, leftX, amountBoxY + 8);
    doc.text(`Next service for your vehicle is due at ${displayNextServiceKM || ""} KM`, leftX, amountBoxY + 13);
  }
  doc.setTextColor(0, 0, 0);

  const upiId = payload.shopSettings.upiId?.trim() || ""
  const upiAmount = Math.max(Number(netPayable || 0), 0).toFixed(2)
  const upiNote = `JobCard ${payload.jobCardNumber || payload.serviceId || "Payment"}`
  
  let qrPayload: string
  if (isValidUpiId(upiId) && Number(upiAmount) > 0) {
    // UPI payment format: upi://pay?pa=<VPA>&pn=<Name>&am=<Amount>&cu=<Currency>&tn=<Note>
    qrPayload = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payload.shopSettings.shopName || "AUTO GARAGE")}&am=${upiAmount}&cu=INR&tn=${encodeURIComponent(upiNote)}`
    console.log("UPI QR Code generated:", qrPayload)
  } else {
    // Fallback to jobcard number
    qrPayload = payload.jobCardNumber || "No JobCard Number"
    console.log("Fallback QR Code (JobCard):", qrPayload)
  }

  const qrDataUrl = await QRCode.toDataURL(qrPayload, { 
    width: 140,
    margin: 1,
    errorCorrectionLevel: 'M'
  });
  const qrX = leftX
  const qrY = 260
  const qrSize = 24
  doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);
  // Add 'Scan to pay' label and amount centered under the QR code
  try {
    doc.setFont("helvetica", "bold")
    doc.setFontSize(9)
    doc.text("Scan to pay", qrX + qrSize / 2, qrY + qrSize + 6, { align: "center" })
  } catch (e) {
    // If text drawing fails for any reason, continue without blocking PDF generation
    console.warn("Failed to render scan-to-pay label:", e)
  }
  doc.text(`For ${payload.shopSettings.shopName || "AUTO GARAGE"}`, 196, 275, { align: "right" });
  doc.text("Authorised Signatory", 196, 282, { align: "right" });

  window.open(doc.output("bloburl"), "_blank");
}
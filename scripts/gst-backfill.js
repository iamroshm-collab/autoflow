const { PrismaClient } = require('@prisma/client')
const { calculateGST } = require('../services/gstCalculator')

const prisma = new PrismaClient()

async function ensureBranch() {
  const existing = await prisma.branch.findFirst()
  if (existing) return existing
  return prisma.branch.create({
    data: {
      branchName: 'Default Branch',
      stateCode: '00',
      gstin: 'NA0000000000000',
    },
  })
}

async function backfillProducts() {
  const products = await prisma.product.findMany()
  for (const product of products) {
    const gstPercent = product.gstPercent || (product.cgstRate || 0) + (product.sgstRate || 0) + (product.igstRate || 0)
    await prisma.product.update({
      where: { productId: product.productId },
      data: {
        gstPercent,
        isTaxable: gstPercent > 0,
        isInclusive: product.isInclusive ?? false,
      },
    })
  }
}

async function backfillPurchases(branch) {
  const purchases = await prisma.purchase.findMany({ include: { purchaseDetails: true } })

  for (const purchase of purchases) {
    const placeOfSupplyStateCode = purchase.placeOfSupplyStateCode || purchase.stateId || branch.stateCode
    let totals = { taxable: 0, cgst: 0, sgst: 0, igst: 0, grand: 0 }

    for (const detail of purchase.purchaseDetails) {
      const taxableValue = detail.taxableValue ?? detail.amount ?? 0
      const gstPercent = detail.gstPercent || (detail.cgstRate || 0) + (detail.sgstRate || 0) + (detail.igstRate || 0)
      const recalculated = calculateGST({
        branchStateCode: branch.stateCode,
        placeOfSupplyStateCode,
        taxableValue,
        gstPercent,
        isInclusive: detail.isInclusive || false,
      })

      await prisma.purchaseDetail.update({
        where: { purchaseDetailsId: detail.purchaseDetailsId },
        data: {
          gstPercent,
          taxableValue: recalculated.taxableValue,
          sgstRate: recalculated.appliedRates.sgstRate,
          cgstRate: recalculated.appliedRates.cgstRate,
          sgstAmount: recalculated.sgstAmount,
          cgstAmount: recalculated.cgstAmount,
          igstAmount: recalculated.igstAmount,
          totalAmount: recalculated.lineTotal,
        },
      })

      totals.taxable += recalculated.taxableValue
      totals.cgst += recalculated.cgstAmount
      totals.sgst += recalculated.sgstAmount
      totals.igst += recalculated.igstAmount
      totals.grand += recalculated.lineTotal
    }

    await prisma.purchase.update({
      where: { purchaseId: purchase.purchaseId },
      data: {
        branchId: purchase.branchId || branch.id,
        placeOfSupplyStateCode,
        supplierGstin: purchase.supplierGstin || purchase.gstin || null,
        invoiceType: purchase.invoiceType || (purchase.gstin || purchase.supplierGstin ? 'B2B' : 'B2C'),
        totalTaxableAmount: totals.taxable,
        totalCgst: totals.cgst,
        totalSgst: totals.sgst,
        totalIgst: totals.igst,
        grandTotal: totals.grand,
      },
    })

    const existingLedger = await prisma.itcLedger.findFirst({ where: { sourceType: 'purchase', sourceId: purchase.purchaseId } })
    if (!existingLedger) {
      await prisma.itcLedger.create({
        data: {
          branchId: purchase.branchId || branch.id,
          sourceType: 'purchase',
          sourceId: purchase.purchaseId,
          igstCredit: totals.igst,
          cgstCredit: totals.cgst,
          sgstCredit: totals.sgst,
          balanceIgst: totals.igst,
          balanceCgst: totals.cgst,
          balanceSgst: totals.sgst,
        },
      })
    }
  }
}

async function backfillSales(branch) {
  const sales = await prisma.sale.findMany({ include: { saleDetails: true } })

  for (const sale of sales) {
    const placeOfSupplyStateCode = sale.placeOfSupplyStateCode || sale.stateCode || branch.stateCode
    let totals = { taxable: 0, cgst: 0, sgst: 0, igst: 0, grand: 0 }

    for (const detail of sale.saleDetails) {
      const taxableValue = (detail.taxableValue ?? detail.salePrice * detail.qnty) || 0
      const gstPercent = detail.gstPercent || (detail.cgstRate || 0) + (detail.sgstRate || 0) + (detail.igstRate || 0)
      const recalculated = calculateGST({
        branchStateCode: branch.stateCode,
        placeOfSupplyStateCode,
        taxableValue,
        gstPercent,
        isInclusive: detail.isInclusive || false,
      })

      await prisma.saleDetail.update({
        where: { saleDetailsId: detail.saleDetailsId },
        data: {
          gstPercent,
          taxableValue: recalculated.taxableValue,
          sgstRate: recalculated.appliedRates.sgstRate,
          cgstRate: recalculated.appliedRates.cgstRate,
          igstRate: recalculated.appliedRates.igstRate,
          sgstAmount: recalculated.sgstAmount,
          cgstAmount: recalculated.cgstAmount,
          igstAmount: recalculated.igstAmount,
          totalAmount: recalculated.lineTotal,
        },
      })

      totals.taxable += recalculated.taxableValue
      totals.cgst += recalculated.cgstAmount
      totals.sgst += recalculated.sgstAmount
      totals.igst += recalculated.igstAmount
      totals.grand += recalculated.lineTotal
    }

    await prisma.sale.update({
      where: { saleId: sale.saleId },
      data: {
        branchId: sale.branchId || branch.id,
        placeOfSupplyStateCode,
        customerGstin: sale.customerGstin || sale.gstin || null,
        invoiceType: sale.invoiceType || (sale.customerGstin || sale.gstin ? 'B2B' : 'B2C'),
        totalTaxableAmount: totals.taxable,
        totalCgst: totals.cgst,
        totalSgst: totals.sgst,
        totalIgst: totals.igst,
        grandTotal: totals.grand,
      },
    })
  }
}

async function backfillSuppliers() {
  await prisma.supplier.updateMany({
    where: { gstin: { not: null } },
    data: { isRegistered: true },
  })
}

async function main() {
  const branch = await ensureBranch()
  await backfillSuppliers()
  await backfillProducts()
  await backfillPurchases(branch)
  await backfillSales(branch)
}

main()
  .then(() => {
    console.log('Backfill complete')
  })
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

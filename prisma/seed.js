const { PrismaClient } = require('@prisma/client')
const { calculateGST } = require('../services/gstCalculator')
const fs = require('fs')
const path = require('path')
const prisma = new PrismaClient()

const makeDate = (isoString) => new Date(isoString)

function buildSaleLines({ items, branchStateCode, placeOfSupplyStateCode }) {
  let totals = { taxable: 0, cgst: 0, sgst: 0, igst: 0 }

  const details = items.map((item) => {
    const taxableValue = Number(item.salePrice) * Number(item.qnty)
    const gst = calculateGST({
      branchStateCode,
      placeOfSupplyStateCode,
      taxableValue,
      gstPercent: item.gstPercent || 0,
      isInclusive: item.isInclusive || false,
    })

    totals.taxable += gst.taxableValue
    totals.cgst += gst.cgstAmount
    totals.sgst += gst.sgstAmount
    totals.igst += gst.igstAmount

    const line = {
      productId: item.product.productId,
      product: item.product.productName,
      productDescription: item.product.productDescription || null,
      hsn: item.product.hsnCode || null,
      gstPercent: item.gstPercent || 0,
      taxableValue: Number(gst.taxableValue.toFixed(2)),
      salePrice: item.salePrice,
      qnty: item.qnty,
      unit: item.product.unit,
      sgstRate: gst.appliedRates.sgstRate,
      cgstRate: gst.appliedRates.cgstRate,
      igstRate: gst.appliedRates.igstRate,
      sgstAmount: Number(gst.sgstAmount.toFixed(2)),
      cgstAmount: Number(gst.cgstAmount.toFixed(2)),
      igstAmount: Number(gst.igstAmount.toFixed(2)),
      amount: Number(gst.taxableValue.toFixed(2)),
      totalAmount: Number(gst.lineTotal.toFixed(2)),
    }

    return line
  })

  const grandTotal = totals.taxable + totals.cgst + totals.sgst + totals.igst

  return {
    details,
    totals: {
      taxable: Number(totals.taxable.toFixed(2)),
      cgst: Number(totals.cgst.toFixed(2)),
      sgst: Number(totals.sgst.toFixed(2)),
      igst: Number(totals.igst.toFixed(2)),
      grand: Number(grandTotal.toFixed(2)),
    },
  }
}

async function main() {
  console.log('Clearing existing data (deleteMany in safe order)')

  // child -> parent order to satisfy foreign keys
  await prisma.creditNoteDetail.deleteMany()
  await prisma.creditNoteHeader.deleteMany()
  await prisma.saleDetail.deleteMany()
  await prisma.sale.deleteMany()
  await prisma.purchaseDetail.deleteMany()
  await prisma.purchase.deleteMany()
  await prisma.itcLedger.deleteMany()
  await prisma.serviceDescription.deleteMany()
  await prisma.sparePartsBill.deleteMany()
  await prisma.employeeEarning.deleteMany()
  await prisma.financialTransaction.deleteMany()
  await prisma.monthlyPayroll.deleteMany()
  await prisma.attendancePayroll.deleteMany()
  await prisma.adjustment.deleteMany()
  await prisma.jobCard.deleteMany()
  await prisma.product.deleteMany()
  await prisma.supplier.deleteMany()
  await prisma.category.deleteMany()
  await prisma.employee.deleteMany()
  await prisma.vehicle.deleteMany()
  await prisma.customer.deleteMany()
  await prisma.branch.deleteMany()
  await prisma.state.deleteMany()
  await prisma.vehicleMakeModel.deleteMany()

  console.log('Creating reference data: states, categories, suppliers, products, vehicle makes/models')
  
  // Create all Indian states
  const statesData = [
    { stateName: 'Jammu And Kashmir', stateCode: '01' },
    { stateName: 'Himachal Pradesh', stateCode: '02' },
    { stateName: 'Punjab', stateCode: '03' },
    { stateName: 'Chandigarh', stateCode: '04' },
    { stateName: 'Uttarakhand', stateCode: '05' },
    { stateName: 'Haryana', stateCode: '06' },
    { stateName: 'Delhi', stateCode: '07' },
    { stateName: 'Rajasthan', stateCode: '08' },
    { stateName: 'Uttar Pradesh', stateCode: '09' },
    { stateName: 'Bihar', stateCode: '10' },
    { stateName: 'Sikkim', stateCode: '11' },
    { stateName: 'Arunachal Pradesh', stateCode: '12' },
    { stateName: 'Nagaland', stateCode: '13' },
    { stateName: 'Manipur', stateCode: '14' },
    { stateName: 'Mizoram', stateCode: '15' },
    { stateName: 'Tripura', stateCode: '16' },
    { stateName: 'Meghalaya', stateCode: '17' },
    { stateName: 'Assam', stateCode: '18' },
    { stateName: 'West Bengal', stateCode: '19' },
    { stateName: 'Jharkhand', stateCode: '20' },
    { stateName: 'Orissa', stateCode: '21' },
    { stateName: 'Chhattisgarh', stateCode: '22' },
    { stateName: 'Madhya Pradesh', stateCode: '23' },
    { stateName: 'Gujarat', stateCode: '24' },
    { stateName: 'Dadra And Nagar Haveli & Daman And Diu', stateCode: '26' },
    { stateName: 'Maharashtra', stateCode: '27' },
    { stateName: 'Karnataka', stateCode: '29' },
    { stateName: 'Goa', stateCode: '30' },
    { stateName: 'Lakshadweep', stateCode: '31' },
    { stateName: 'Kerala', stateCode: '32' },
    { stateName: 'Tamil Nadu', stateCode: '33' },
    { stateName: 'Puducherry', stateCode: '34' },
    { stateName: 'Andaman And Nicobar', stateCode: '35' },
    { stateName: 'Telangana', stateCode: '36' },
    { stateName: 'Andhra Pradesh', stateCode: '37' },
    { stateName: 'Ladakh', stateCode: '38' },
    { stateName: 'Other Territory', stateCode: '97' },
    { stateName: 'Other Country', stateCode: '99' },
  ]

  await prisma.state.createMany({ data: statesData, skipDuplicates: true })
  console.log(`Created ${statesData.length} states`)

  // Fetch Karnataka and Maharashtra states for sample data
  const ka = await prisma.state.findFirst({ where: { stateName: 'Karnataka' } })
  const mh = await prisma.state.findFirst({ where: { stateName: 'Maharashtra' } })

  console.log('Populating vehicle makes and models')
  const vehicleMakesData = JSON.parse(fs.readFileSync(path.join(__dirname, '../database/vehicle-makes-models-seed.json'), 'utf-8'))
  const vehicleMakeModelRecords = []
  for (const makeObj of vehicleMakesData) {
    for (const model of makeObj.models) {
      vehicleMakeModelRecords.push({
        make: makeObj.make,
        model: model,
        category: makeObj.category || 'Car',
      })
    }
  }
  await prisma.vehicleMakeModel.createMany({
    data: vehicleMakeModelRecords,
    skipDuplicates: true,
  })
  console.log(`Created ${vehicleMakeModelRecords.length} vehicle make/model records`)

  const [branchKa, branchMh] = await Promise.all([
    prisma.branch.create({ data: { branchName: 'Bangalore HQ', stateCode: 'KA', gstin: '29AAAAA0000A1Z5' } }),
    prisma.branch.create({ data: { branchName: 'Mumbai Outlet', stateCode: 'MH', gstin: '27AAAAA0000A1Z5' } }),
  ])

  const [catEngine, catTyres] = await Promise.all([
    prisma.category.create({ data: { categoryName: 'Engine Parts', description: 'Engine & lubricants' } }),
    prisma.category.create({ data: { categoryName: 'Tyres & Wheels', description: 'Tyres and wheel accessories' } }),
  ])

  const supplier = await prisma.supplier.create({
    data: {
      supplierName: 'AutoSupplies Pvt Ltd',
      address: '12 Supply Street, Bangalore',
      mobileNo: '8888888888',
      stateId: ka.stateId,
      gstin: 'GSTIN-SUPP-001',
      pan: 'PAN-SUPP-001',
    },
  })

  const products = await Promise.all([
    prisma.product.create({
      data: {
        supplierId: supplier.supplierId,
        categoryId: catEngine.categoryId,
        productName: '5W-30 Engine Oil',
        unit: 'Litre',
        mrp: 650,
        purchasePrice: 420,
        salePrice: 500,
        hsnCode: '2710',
        gstPercent: 18,
        cgstRate: 9,
        sgstRate: 9,
        balanceStock: 100,
      },
    }),
    prisma.product.create({
      data: {
        supplierId: supplier.supplierId,
        categoryId: catEngine.categoryId,
        productName: 'Air Filter',
        unit: 'Piece',
        mrp: 350,
        purchasePrice: 220,
        salePrice: 300,
        hsnCode: '8421',
        gstPercent: 18,
        cgstRate: 9,
        sgstRate: 9,
        balanceStock: 80,
      },
    }),
    prisma.product.create({
      data: {
        supplierId: supplier.supplierId,
        categoryId: catTyres.categoryId,
        productName: 'Tubeless Tyre 14"',
        unit: 'Piece',
        mrp: 4200,
        purchasePrice: 3200,
        salePrice: 3800,
        hsnCode: '4011',
        gstPercent: 28,
        cgstRate: 14,
        sgstRate: 14,
        balanceStock: 60,
      },
    }),
    prisma.product.create({
      data: {
        supplierId: supplier.supplierId,
        categoryId: catTyres.categoryId,
        productName: 'Wheel Nut',
        unit: 'Piece',
        mrp: 50,
        purchasePrice: 20,
        salePrice: 35,
        hsnCode: '7318',
        gstPercent: 18,
        cgstRate: 9,
        sgstRate: 9,
        balanceStock: 500,
      },
    }),
  ])

  const [engineOil, airFilter, tyre, wheelNut] = products

  // Additional sample suppliers and products
  const supplier2 = await prisma.supplier.create({
    data: {
      supplierName: 'BrakeWorks Ltd',
      address: '45 Brake Lane, Pune',
      mobileNo: '7777777777',
      stateId: mh.stateId,
      gstin: 'GSTIN-SUPP-002',
      pan: 'PAN-SUPP-002',
    },
  })

  const supplier3 = await prisma.supplier.create({
    data: {
      supplierName: 'WheelHouse Co',
      address: '88 Wheel Road, Mumbai',
      mobileNo: '6666666666',
      stateId: mh.stateId,
      gstin: 'GSTIN-SUPP-003',
      pan: 'PAN-SUPP-003',
    },
  })

  const [brakePad, brakeFluid, alloyWheel, valveStem] = await Promise.all([
    prisma.product.create({
      data: {
        supplierId: supplier2.supplierId,
        categoryId: catTyres.categoryId,
        productName: 'Brake Pad Set',
        unit: 'Set',
        mrp: 1200,
        purchasePrice: 800,
        salePrice: 1000,
        hsnCode: '8708',
        gstPercent: 18,
        cgstRate: 9,
        sgstRate: 9,
        balanceStock: 80,
      },
    }),
    prisma.product.create({
      data: {
        supplierId: supplier2.supplierId,
        categoryId: catEngine.categoryId,
        productName: 'Brake Fluid 1L',
        unit: 'Litre',
        mrp: 300,
        purchasePrice: 180,
        salePrice: 250,
        hsnCode: '3819',
        gstPercent: 18,
        cgstRate: 9,
        sgstRate: 9,
        balanceStock: 120,
      },
    }),
    prisma.product.create({
      data: {
        supplierId: supplier3.supplierId,
        categoryId: catTyres.categoryId,
        productName: 'Alloy Wheel 15"',
        unit: 'Piece',
        mrp: 7500,
        purchasePrice: 5500,
        salePrice: 7000,
        hsnCode: '8708',
        gstPercent: 28,
        cgstRate: 14,
        sgstRate: 14,
        balanceStock: 80,
      },
    }),
    prisma.product.create({
      data: {
        supplierId: supplier3.supplierId,
        categoryId: catTyres.categoryId,
        productName: 'Valve Stem',
        unit: 'Piece',
        mrp: 30,
        purchasePrice: 10,
        salePrice: 20,
        hsnCode: '8481',
        gstPercent: 12,
        cgstRate: 6,
        sgstRate: 6,
        balanceStock: 800,
      },
    }),
  ])

  // Add duplicate product entries for testing modal selection with same name but different prices
  await Promise.all([
    prisma.product.create({
      data: {
        supplierId: supplier.supplierId,
        categoryId: catEngine.categoryId,
        productName: 'Seed Supplier 1 Product 1',
        unit: 'Piece',
        mrp: 150,
        purchasePrice: 100,
        salePrice: 130,
        balanceStock: 25,
      },
    }),
    prisma.product.create({
      data: {
        supplierId: supplier.supplierId,
        categoryId: catEngine.categoryId,
        productName: 'Seed Supplier 1 Product 1',
        unit: 'Piece',
        mrp: 180,
        purchasePrice: 120,
        salePrice: 150,
        balanceStock: 30,
      },
    }),
  ])

  console.log('Creating customers and vehicles')
  const customers = await Promise.all([
    prisma.customer.create({ data: { name: 'John Doe', mobileNo: '9999999999', address: '123 Main Street, Bangalore' } }),
    prisma.customer.create({ data: { name: 'Priya Sharma', mobileNo: '9888888888', address: '456 Park Avenue, Bangalore' } }),
    prisma.customer.create({ data: { name: 'Amit Patel', mobileNo: '9777777777', address: '789 Market Road, Pune' } }),
    prisma.customer.create({ data: { name: 'Neha Singh', mobileNo: '9666666666', address: '12 Residency Road, Mumbai' } }),
    prisma.customer.create({ data: { name: 'Vikram Reddy', mobileNo: '9555555555', address: '99 Industrial Area, Bangalore' } }),
  ])

  const vehicles = []
  vehicles.push(await prisma.vehicle.create({ data: { registrationNumber: 'KA-01-AB-1234', make: 'Maruti', model: 'Swift', lastCustomerId: customers[0].id } }))
  vehicles.push(await prisma.vehicle.create({ data: { registrationNumber: 'KA-01-AB-5678', make: 'Hyundai', model: 'i10', lastCustomerId: customers[0].id } }))
  vehicles.push(await prisma.vehicle.create({ data: { registrationNumber: 'KA-02-CD-1234', make: 'Tata', model: 'Nexon', lastCustomerId: customers[1].id } }))
  vehicles.push(await prisma.vehicle.create({ data: { registrationNumber: 'MH-04-XY-0001', make: 'Toyota', model: 'Innova', lastCustomerId: customers[2].id } }))
  vehicles.push(await prisma.vehicle.create({ data: { registrationNumber: 'MH-04-XY-0002', make: 'Mahindra', model: 'XUV500', lastCustomerId: customers[2].id } }))

  console.log('Creating employees and attendance/adjustments/monthly payrolls')
  const employees = await Promise.all([
    prisma.employee.create({ data: { empName: 'Raghav Kumar', idNumber: 'EMP001', mobile: '9000000001', designation: 'Technician', salaryPerday: 600, startDate: new Date() } }),
    prisma.employee.create({ data: { empName: 'Suresh B', idNumber: 'EMP002', mobile: '9000000002', designation: 'Supervisor', salaryPerday: 900, startDate: new Date() } }),
    prisma.employee.create({ data: { empName: 'Anita R', idNumber: 'EMP003', mobile: '9000000003', designation: 'Cashier', salaryPerday: 400, startDate: new Date() } }),
    prisma.employee.create({ data: { empName: 'Kiran P', idNumber: 'EMP004', mobile: '9000000004', designation: 'Helper', salaryPerday: 350, startDate: new Date() } }),
  ])

  // Attendance for yesterday
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  await Promise.all(
    employees.map((emp, idx) =>
      prisma.attendancePayroll.create({
        data: {
          employeeId: emp.employeeId,
          attendanceDate: yesterday,
          attendance: idx % 4 === 0 ? 'P' : idx % 4 === 1 ? 'H' : idx % 4 === 2 ? 'L' : 'A',
          salaryAdvance: idx === 1 ? 200 : 0,
          incentive: idx === 0 ? 150 : 0,
          allowance: idx === 2 ? 100 : 0,
        },
      })
    )
  )

  // Adjustments
  await prisma.adjustment.createMany({
    data: [
      { employeeId: employees[0].employeeId, adjustmentType: 'Allowance', amount: 500, adjustmentDate: new Date(), remarks: 'Travel allowance' },
      { employeeId: employees[1].employeeId, adjustmentType: 'Advance', amount: 1000, adjustmentDate: new Date(), remarks: 'Taken advance' },
      { employeeId: employees[2].employeeId, adjustmentType: 'Incentive', amount: 250, adjustmentDate: new Date(), remarks: 'Performance bonus' },
    ],
  })

  // Monthly payroll sample for current month
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  await Promise.all(
    employees.map((emp, idx) =>
      prisma.monthlyPayroll.create({
        data: {
          employeeId: emp.employeeId,
          month,
          year,
          basicSalary: emp.salaryPerday * 26,
          totalPresent: 22 - idx,
          totalHalfDay: 1,
          totalLeave: 2,
          totalAbsent: idx,
          totalAllowance: idx === 0 ? 500 : 0,
          totalIncentive: idx === 2 ? 250 : 0,
          totalAdvance: idx === 1 ? 1000 : 0,
          netSalary: Math.max(0, emp.salaryPerday * 26 - (idx === 1 ? 1000 : 0) + (idx === 0 ? 500 : 0) + (idx === 2 ? 250 : 0)),
          generatedBy: 'seed-script',
        },
      })
    )
  )

  console.log('Creating purchases and updating product stock')
  const purchase1 = await prisma.purchase.create({
    data: {
      purchaseDate: makeDate('2026-01-05T10:00:00Z'),
      supplierId: supplier.supplierId,
      branchId: branchKa.id,
      supplier: supplier.supplierName,
      address: supplier.address,
      mobileNo: supplier.mobileNo,
      gstin: supplier.gstin,
      pan: supplier.pan,
      billNumber: 'P-1001',
      placeOfSupplyStateCode: 'KA',
      purchaseDetails: {
        create: [
          { productId: engineOil.productId, product: engineOil.productName, qnty: 20, purchasePrice: 400, mrp: 650, salePrice: 500, gstPercent: 18, cgstRate: 9, sgstRate: 9, amount: 8000, taxableValue: 8000, sgstAmount: 720, cgstAmount: 720, totalAmount: 9440, balanceStock: 20 },
          { productId: airFilter.productId, product: airFilter.productName, qnty: 15, purchasePrice: 200, mrp: 350, salePrice: 300, gstPercent: 18, cgstRate: 9, sgstRate: 9, amount: 3000, taxableValue: 3000, sgstAmount: 270, cgstAmount: 270, totalAmount: 3540, balanceStock: 15 },
        ],
      },
    },
    include: { purchaseDetails: true },
  })

  // increment product balanceStock to reflect purchase
  await prisma.product.update({ where: { productId: engineOil.productId }, data: { balanceStock: { increment: 20 } } })
  await prisma.product.update({ where: { productId: airFilter.productId }, data: { balanceStock: { increment: 15 } } })

  console.log('Creating jobcards, service descriptions, spare parts bills and employee earnings')
  const jobCard1 = await prisma.jobCard.create({
    data: {
      jobCardNumber: 'JC-1001',
      serviceDate: new Date(),
      customerId: customers[0].id,
      vehicleId: vehicles[0].id,
      total: 4500,
      paidAmount: 0,
      vehicleStatus: 'In Garage',
      jobcardStatus: 'Under Service',
      serviceDescriptions: {
        create: [
          { sl: 1, description: 'Oil change', qnty: 1, salePrice: 500, amount: 500, totalAmount: 500 },
          { sl: 2, description: 'Replace air filter', qnty: 1, salePrice: 300, amount: 300, totalAmount: 300 },
        ],
      },
      sparePartsBills: {
        create: [
          { sl: 1, shopName: 'SpareHouse', vehicleMake: vehicles[0].make, vehicleModel: vehicles[0].model, registrationNumber: vehicles[0].registrationNumber, billDate: new Date(), billNumber: 'SP-1001', amount: 3700, paid: 0 },
        ],
      },
    },
    include: { serviceDescriptions: true, sparePartsBills: true },
  })

  // employee earnings for the jobcard
  await prisma.employeeEarning.create({ data: { sl: 1, jobCardId: jobCard1.id, transactionDate: new Date(), vehicleModel: vehicles[0].model, vehicleMake: vehicles[0].make, registrationNumber: vehicles[0].registrationNumber, employee: employees[0].empName, employeeID: String(employees[0].employeeId), workType: 'Oil Change', amount: 300 } })

  console.log('Creating multi-month sales with GST splits')
  const saleTemplates = [
    {
      billNumber: 'S-DEC-B2B',
      billDate: makeDate('2025-12-12T10:00:00Z'),
      branch: branchKa,
      placeOfSupplyStateCode: 'KA',
      invoiceType: 'B2B',
      customer: 'Acme Motors Pvt Ltd',
      customerGstin: '29ACMEP1234F1Z5',
      items: [
        { product: engineOil, qnty: 10, salePrice: 520, gstPercent: 18 },
        { product: airFilter, qnty: 5, salePrice: 320, gstPercent: 18 },
      ],
    },
    {
      billNumber: 'S-JAN-B2B-IGST',
      billDate: makeDate('2026-01-22T10:00:00Z'),
      branch: branchKa,
      placeOfSupplyStateCode: 'MH',
      invoiceType: 'B2B',
      customer: 'Western Auto LLP',
      customerGstin: '27WESAU1234L1Z5',
      items: [
        { product: tyre, qnty: 2, salePrice: 3900, gstPercent: 28 },
        { product: engineOil, qnty: 6, salePrice: 520, gstPercent: 18 },
      ],
    },
    {
      billNumber: 'S-JAN-B2C-SMALL',
      billDate: makeDate('2026-01-10T10:00:00Z'),
      branch: branchKa,
      placeOfSupplyStateCode: 'KA',
      invoiceType: 'B2C',
      customer: 'Walk-in Customer',
      items: [
        { product: wheelNut, qnty: 20, salePrice: 40, gstPercent: 18 },
        { product: brakePad, qnty: 2, salePrice: 1050, gstPercent: 18 },
      ],
    },
    {
      billNumber: 'S-FEB-B2C-LARGE',
      billDate: makeDate('2026-02-15T10:00:00Z'),
      branch: branchMh,
      placeOfSupplyStateCode: 'KA',
      invoiceType: 'B2C',
      customer: 'Fleet Customer',
      mobileNo: '9988776655',
      address: 'Bulk order for fleet',
      items: [
        { product: alloyWheel, qnty: 40, salePrice: 7000, gstPercent: 28 },
      ],
    },
  ]

  const createdSales = []
  for (const template of saleTemplates) {
    const { details, totals } = buildSaleLines({
      items: template.items,
      branchStateCode: template.branch.stateCode,
      placeOfSupplyStateCode: template.placeOfSupplyStateCode,
    })

    const sale = await prisma.sale.create({
      data: {
        billNumber: template.billNumber,
        billDate: template.billDate,
        branchId: template.branch.id,
        customer: template.customer,
        address: template.address || '',
        mobileNo: template.mobileNo || '',
        billType: template.billType || 'Cash',
        saleType: template.saleType || 'Retail',
        gstin: template.gstin || template.branch.gstin,
        customerGstin: template.customerGstin || null,
        stateCode: template.branch.stateCode,
        placeOfSupplyStateCode: template.placeOfSupplyStateCode,
        taxable: true,
        invoiceType: template.invoiceType,
        totalTaxableAmount: totals.taxable,
        totalCgst: totals.cgst,
        totalSgst: totals.sgst,
        totalIgst: totals.igst,
        grandTotal: totals.grand,
        saleDetails: { create: details },
      },
      include: { saleDetails: true },
    })

    createdSales.push(sale)
  }

  for (const sale of createdSales) {
    for (const line of sale.saleDetails) {
      await prisma.product.update({ where: { productId: line.productId }, data: { balanceStock: { decrement: line.qnty } } })
    }
  }

  console.log('Creating credit notes to adjust GST for returns')
  const igstSale = createdSales.find((sale) => sale.billNumber === 'S-JAN-B2B-IGST')
  if (igstSale) {
    const tyreLine = igstSale.saleDetails.find((detail) => detail.productId === tyre.productId)
    if (tyreLine) {
      const returnQnty = 1
      const unitTaxable = tyreLine.taxableValue / tyreLine.qnty
      const unitIgst = tyreLine.igstAmount / tyreLine.qnty
      const taxableValue = Number((unitTaxable * returnQnty).toFixed(2))
      const igstAmount = Number((unitIgst * returnQnty).toFixed(2))
      const lineTotal = Number((taxableValue + igstAmount).toFixed(2))

      await prisma.creditNoteHeader.create({
        data: {
          salesId: igstSale.saleId,
          branchId: igstSale.branchId,
          creditNoteNumber: 'CN-2026-01',
          creditNoteDate: makeDate('2026-02-01T10:00:00Z'),
          reason: 'Return of one tyre',
          totalTaxableAmount: taxableValue,
          totalCgst: 0,
          totalSgst: 0,
          totalIgst: igstAmount,
          grandTotal: lineTotal,
          details: {
            create: [
              {
                salesDetailsId: tyreLine.saleDetailsId,
                productId: tyreLine.productId,
                hsnCode: tyreLine.hsn,
                gstPercent: tyreLine.gstPercent || 0,
                taxableValue,
                cgstAmount: 0,
                sgstAmount: 0,
                igstAmount,
                quantity: returnQnty,
              },
            ],
          },
        },
      })
    }
  }

  console.log('Creating ITC ledger entries for 3 months')
  await prisma.itcLedger.createMany({
    data: [
      { branchId: branchKa.id, sourceType: 'Purchase', sourceId: 1, igstCredit: 0, cgstCredit: 1200, sgstCredit: 1200, utilizedIgst: 0, utilizedCgst: 400, utilizedSgst: 400, balanceIgst: 0, balanceCgst: 800, balanceSgst: 800 },
      { branchId: branchKa.id, sourceType: 'Purchase', sourceId: 2, igstCredit: 3200, cgstCredit: 0, sgstCredit: 0, utilizedIgst: 1000, utilizedCgst: 0, utilizedSgst: 0, balanceIgst: 2200, balanceCgst: 0, balanceSgst: 0 },
      { branchId: branchMh.id, sourceType: 'Purchase', sourceId: 3, igstCredit: 0, cgstCredit: 1500, sgstCredit: 1500, utilizedIgst: 0, utilizedCgst: 300, utilizedSgst: 300, balanceIgst: 0, balanceCgst: 1200, balanceSgst: 1200 },
    ],
  })

  const b2cLargeSale = createdSales.find((sale) => sale.billNumber === 'S-FEB-B2C-LARGE')

  console.log('Creating financial transactions')
  await prisma.financialTransaction.createMany({ data: [
    { transactionType: 'Sale', transactionDate: makeDate('2026-01-22T12:00:00Z'), description: 'POS sale S-JAN-B2B-IGST', vehicleId: null, employeeId: employees[2].employeeId, paymentType: 'Card', transactionAmount: igstSale?.grandTotal || 0 },
    { transactionType: 'Sale', transactionDate: makeDate('2026-02-15T12:00:00Z'), description: 'POS sale S-FEB-B2C-LARGE', vehicleId: null, employeeId: employees[2].employeeId, paymentType: 'Cash', transactionAmount: b2cLargeSale?.grandTotal || 0 },
    { transactionType: 'Purchase', transactionDate: makeDate('2025-12-05T12:00:00Z'), description: 'Purchase ITC seed', vehicleId: null, employeeId: null, paymentType: 'Credit', transactionAmount: 12980 },
  ] })

  // simple summary counts
  const summary = {
    customers: await prisma.customer.count(),
    vehicles: await prisma.vehicle.count(),
    employees: await prisma.employee.count(),
    products: await prisma.product.count(),
    branches: await prisma.branch.count(),
    purchases: await prisma.purchase.count(),
    sales: await prisma.sale.count(),
    creditNotes: await prisma.creditNoteHeader.count(),
    itcLedgers: await prisma.itcLedger.count(),
    jobcards: await prisma.jobCard.count(),
    attendance: await prisma.attendancePayroll.count(),
    adjustments: await prisma.adjustment.count(),
    payrolls: await prisma.monthlyPayroll.count(),
  }

  console.log('Seeding complete — summary:')
  console.table(summary)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

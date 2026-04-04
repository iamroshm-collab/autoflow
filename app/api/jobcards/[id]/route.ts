import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  sendJobAssignmentNotification,
  sendJobAssignmentNotifications,
  sendJobDeletedNotifications,
  sendJobReassignedNotifications,
} from "@/services/notificationService"
import { createRoleNotifications } from "@/lib/app-notifications"
import { sendMetaWhatsappJobCardNotification } from "@/lib/meta-whatsapp"

interface SparePartPayload {
  shopName: string
  billDate: string
  billNumber: string
  item: string
  returnedItem?: string
  amount: number
  paid?: number
  paidDate?: string
  isReturn: boolean
  returnDate: string
  returnAmount: number
}

interface ServicePayload {
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

interface TechnicianPayload {
  employeeName: string
  workType: string
  taskAssigned: string
  allocationAmount: number
}

interface FinancialTransactionPayload {
  id?: string
  transactionType: string
  transactionDate: string
  paymentType: string
  applyTo: string
  transactionAmount: number
  description?: string
}

const normalizeApplyTo = (value: string | undefined) =>
  (value || "").trim().toLowerCase()

const normalizePersonName = (value: string | undefined) =>
  (value || "").trim().toLowerCase()

const parseValidDate = (value: unknown): Date | null => {
  if (!value) {
    return null
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  // Supports dd-mm-yy (legacy UI format)
  const ddMmYyMatch = trimmed.match(/^(\d{2})-(\d{2})-(\d{2})$/)
  if (ddMmYyMatch) {
    const [, dd, mm, yy] = ddMmYyMatch
    const day = Number(dd)
    const month = Number(mm)
    const year = 2000 + Number(yy)
    const parsed = new Date(year, month - 1, day)
    if (
      parsed.getFullYear() === year &&
      parsed.getMonth() === month - 1 &&
      parsed.getDate() === day
    ) {
      return parsed
    }
    return null
  }

  const parsed = new Date(trimmed)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const jobCard = await prisma.jobCard.findUnique({
      where: { id },
      include: {
        customer: true,
        vehicle: true,
        serviceDescriptions: true,
        sparePartsBills: true,
        employeeEarnings: true,
      },
    })

    if (!jobCard) {
      return NextResponse.json({ error: "JobCard not found" }, { status: 404 })
    }

    return NextResponse.json(jobCard)
  } catch (error) {
    console.error("[JOBCARDS_ID_GET]", error)
    return NextResponse.json({ error: "Failed to fetch jobcard" }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    console.log("[JOBCARDS_ID_PUT] Request received", { 
      id, 
      hasFinancialTransactions: !!body.financialTransactions,
      financialTransactionsCount: Array.isArray(body.financialTransactions) ? body.financialTransactions.length : 0
    })

    const {
      customerId,
      vehicleId,
      fileNo,
      serviceDate,
      jobcardStatus,
      deliveryStatus,
      maintenanceType,
      deliveryDate,
      nextServiceDate,
      nextServiceKM,
      odo,
      total,
      totalBill,
      advance,
      taxable,
      advancePayment,
      discount,
      paidDate,
      paymentStatus,
      balance,
      externalShop,
      externalShopRemarks,
      spareParts,
      services,
      technicians,
      financialTransactions,
    } = body

    if (!customerId || !vehicleId || !serviceDate) {
      return NextResponse.json(
        { error: "Missing required fields for update" },
        { status: 400 }
      )
    }

    const parsedServiceDate = parseValidDate(serviceDate)
    if (!parsedServiceDate) {
      return NextResponse.json(
        { error: "Invalid serviceDate. Use YYYY-MM-DD or dd-mm-yy format." },
        { status: 400 }
      )
    }

    const parsedDeliveryDate = deliveryDate ? parseValidDate(deliveryDate) : null
    if (deliveryDate && !parsedDeliveryDate) {
      return NextResponse.json(
        { error: "Invalid deliveryDate. Use YYYY-MM-DD or dd-mm-yy format." },
        { status: 400 }
      )
    }

    const parsedNextServiceDate = nextServiceDate ? parseValidDate(nextServiceDate) : null
    if (nextServiceDate && !parsedNextServiceDate) {
      return NextResponse.json(
        { error: "Invalid nextServiceDate. Use YYYY-MM-DD or dd-mm-yy format." },
        { status: 400 }
      )
    }

    const parsedPaidDate = paidDate ? parseValidDate(paidDate) : null
    if (paidDate && !parsedPaidDate) {
      return NextResponse.json(
        { error: "Invalid paidDate. Use YYYY-MM-DD or dd-mm-yy format." },
        { status: 400 }
      )
    }

    const existing = await prisma.jobCard.findUnique({
      where: { id },
      include: {
        technicianAllocations: {
          where: { status: { in: ["assigned", "accepted", "in_progress"] } },
          select: { employeeId: true },
        },
      },
    })
    if (!existing) {
      return NextResponse.json({ error: "JobCard not found" }, { status: 404 })
    }

    const safeSpareParts: SparePartPayload[] = Array.isArray(spareParts) ? spareParts : []
    const safeServices: ServicePayload[] = Array.isArray(services) ? services : []
    const safeTechnicians: TechnicianPayload[] = Array.isArray(technicians) ? technicians : []
    const safeFinancialTransactions: FinancialTransactionPayload[] = Array.isArray(financialTransactions) ? financialTransactions : []

    // Resolve incoming technician names to employee IDs (ID-based comparison avoids name-mismatch bugs)
    const incomingTechnicianNames = safeTechnicians
      .map((item) => (item.employeeName || "").trim())
      .filter(Boolean)

    const incomingEmployees = incomingTechnicianNames.length
      ? await prisma.employee.findMany({
          where: {
            isTechnician: true,
            isArchived: false,
            empName: { in: incomingTechnicianNames, mode: "insensitive" },
          },
          select: { employeeId: true, empName: true },
        })
      : []

    const incomingEmployeeIdSet = new Set(incomingEmployees.map((e) => e.employeeId))
    const existingAllocationEmployeeIdSet = new Set(
      existing.technicianAllocations.map((a) => a.employeeId)
    )

    const newlyAssignedEmployeeIds = [...incomingEmployeeIdSet].filter(
      (empId) => !existingAllocationEmployeeIdSet.has(empId)
    )
    const removedEmployeeIds = [...existingAllocationEmployeeIdSet].filter(
      (empId) => !incomingEmployeeIdSet.has(empId)
    )

    const billPaymentRows = safeFinancialTransactions.filter(
      (item) => normalizeApplyTo(item.applyTo) === "bill payment" && Number(item.transactionAmount || 0) > 0
    )
    const advancePaymentRows = safeFinancialTransactions.filter(
      (item) => normalizeApplyTo(item.applyTo) === "advance payment" && Number(item.transactionAmount || 0) > 0
    )

    const billPaymentTotal = billPaymentRows.reduce(
      (sum, item) => sum + Number(item.transactionAmount || 0),
      0
    )
    const advancePaymentTotal = advancePaymentRows.reduce(
      (sum, item) => sum + Number(item.transactionAmount || 0),
      0
    )

    const latestBillPaymentDate = billPaymentRows
      .map((item) => new Date(item.transactionDate))
      .filter((date) => !Number.isNaN(date.getTime()))
      .sort((a, b) => b.getTime() - a.getTime())[0] || null

    // When financial transactions are provided, derive paid/advance fields from them.
    const effectivePaidAmount =
      safeFinancialTransactions.length > 0 ? billPaymentTotal : Number(advance || 0)
    const effectiveAdvancePayment =
      safeFinancialTransactions.length > 0 ? advancePaymentTotal : Number(advancePayment || 0)
    const totalAmount = Number(totalBill || total || 0)
    const effectiveBalance = Math.max(totalAmount - effectivePaidAmount - effectiveAdvancePayment, 0)
    const effectivePaidDate = latestBillPaymentDate || parsedPaidDate

    const resolvedPaymentStatus =
      paymentStatus ||
      (effectivePaidAmount <= 0 ? "Pending" : effectiveBalance > 0 ? "Partial" : "Completed")

    const updated = await prisma.$transaction(async (tx) => {
      console.log("[JOBCARDS_ID_PUT] Starting transaction, deleting existing records", { id })
      
      await tx.serviceDescription.deleteMany({ where: { jobCardId: id } })
      await tx.sparePartsBill.deleteMany({ where: { jobCardId: id } })
      await tx.employeeEarning.deleteMany({ where: { jobCardId: id } })
      
      console.log("[JOBCARDS_ID_PUT] Attempting to delete existing financial transactions")
      const deleteResult = await tx.financialTransaction.deleteMany({ where: { jobCardId: id } })
      console.log("[JOBCARDS_ID_PUT] Deleted financial transactions", { count: deleteResult.count })

      // When job card status is NEWLY changed to Completed, set vehicle status to Ready
      // If job card is already Completed, respect the user-provided deliveryStatus
      let finalVehicleStatus = deliveryStatus || "Pending"
      if (existing.jobcardStatus !== "Completed" && jobcardStatus === "Completed") {
        // Only force to Ready when status is CHANGING to Completed
        finalVehicleStatus = "Ready"
      }

      const jobCard = await tx.jobCard.update({
        where: { id },
        data: {
          customerId,
          vehicleId,
          fileNo: fileNo || null,
          serviceDate: parsedServiceDate,
          jobcardStatus: jobcardStatus || "Under Service",
          vehicleStatus: finalVehicleStatus,
          maintenanceType: maintenanceType || null,
          deliveryDate: parsedDeliveryDate,
          nextServiceDate: parsedNextServiceDate,
          nextServiceKM: nextServiceKM ? Number(nextServiceKM) : null,
          kmDriven: odo ? Number(odo) : null,
          total: totalAmount,
          paidAmount: effectivePaidAmount,
          taxable: Boolean(taxable),
          advancePayment: effectiveAdvancePayment,
          discount: Number(discount || 0),
          paidDate: effectivePaidDate,
          balance: effectiveBalance,
          jobcardPaymentStatus: resolvedPaymentStatus,
          externalShop: Boolean(externalShop),
          externalShopRemarks: externalShopRemarks || null,
        },
      })

      if (safeSpareParts.length > 0) {
        const vehicle = await tx.vehicle.findUnique({ where: { id: vehicleId } })

        await tx.sparePartsBill.createMany({
          data: safeSpareParts.map((item, index) => ({
            sl: index + 1,
            jobCardId: id,
            shopName: item.shopName || "AutoFlow",
            address: null,
            vehicleMake: vehicle?.make || "",
            vehicleModel: vehicle?.model || "",
            registrationNumber: vehicle?.registrationNumber || "",
            billDate: item.billDate ? new Date(item.billDate) : parsedServiceDate,
            billNumber: item.billNumber || `${jobCard.jobCardNumber}-SP-${index + 1}`,
            amount: Number(item.amount || 0),
            paid: Number(item.paid || 0),
            paidDate: item.paidDate ? new Date(item.paidDate) : null,
            itemDescription: item.item || null,
            returnedItem: item.returnedItem || null,
            billReturned:
              Boolean(item.isReturn) ||
              Number(item.returnAmount || 0) > 0 ||
              Boolean(item.returnDate),
            returnAmount: Number(item.returnAmount || 0),
            returnedDate: item.returnDate ? new Date(item.returnDate) : null,
          })),
        })
      }

      if (safeServices.length > 0) {
        await tx.serviceDescription.createMany({
          data: safeServices.map((item, index) => {
            const amount = Number(item.amount || 0)
            const discountRate = Number((item as any).discountRate || 0)
            const discountAmount = Number((item as any).discountAmount || 0)
            const cgstRate = Number((item as any).cgstRate || 0)
            const sgstRate = Number((item as any).sgstRate || 0)
            const igstRate = Number((item as any).igstRate || 0)

            const cgstAmount = parseFloat(((amount * cgstRate) / 100).toFixed(2))
            const sgstAmount = parseFloat(((amount * sgstRate) / 100).toFixed(2))
            const igstAmount = parseFloat(((amount * igstRate) / 100).toFixed(2))

            const totalAmount = igstRate > 0
              ? parseFloat((amount + igstAmount).toFixed(2))
              : parseFloat((amount + cgstAmount + sgstAmount).toFixed(2))

            return {
              sl: index + 1,
              jobCardId: id,
              description: item.description || "",
              unit: item.unit || null,
              qnty: Number(item.quantity || 1),
              salePrice: amount,
              amount: amount,
              taxableAmount: amount,
              totalAmount: totalAmount,
              discountRate: discountRate,
              discountAmount: discountAmount,
              cgstRate: cgstRate,
              cgstAmount: cgstAmount,
              sgstRate: sgstRate,
              sgstAmount: sgstAmount,
              igstRate: igstRate,
              igstAmount: igstAmount,
              stateId: item.stateId || null,
            }
          }),
        })
      }

      if (safeTechnicians.length > 0) {
        const vehicle = await tx.vehicle.findUnique({ where: { id: vehicleId } })

        await tx.employeeEarning.createMany({
          data: safeTechnicians.map((item, index) => {
            const technicianTransactionDate = parseValidDate(
              (item as any).transactionDate
            ) || parsedServiceDate

            return {
              sl: index + 1,
              jobCardId: id,
              transactionDate: technicianTransactionDate,
              vehicleModel: vehicle?.model || "",
              vehicleMake: vehicle?.make || "",
              registrationNumber: vehicle?.registrationNumber || "",
              employee: item.employeeName || "",
              employeeID: item.taskAssigned || "",
              workType: item.workType || null,
              amount: Number(item.allocationAmount || 0),
            }
          }),
        })
      }
      if (safeFinancialTransactions.length > 0) {
        console.log("[JOBCARDS_ID_PUT] Processing financial transactions", { count: safeFinancialTransactions.length })
        const vehicle = await tx.vehicle.findUnique({ where: { id: vehicleId } })
        const customer = await tx.customer.findUnique({ where: { id: customerId } })

        console.log("[JOBCARDS_ID_PUT] Vehicle and customer found", { vehicleId, customerId })

        const ftData = safeFinancialTransactions.map((item) => {
          const transactionDate = parseValidDate(item.transactionDate) || parsedServiceDate

          return {
            transactionType: item.transactionType,
            transactionDate: transactionDate,
            description: item.description ? `${item.applyTo}: ${item.description}` : item.applyTo,
            vehicleId: vehicleId,
            jobCardId: id,
            paymentType: item.paymentType,
            transactionAmount: Number(item.transactionAmount || 0),
            customerName: customer?.name || null,
            mobileNumber: customer?.mobileNo || null,
            vehicleMake: vehicle?.make || null,
          }
        })
        
        console.log("[JOBCARDS_ID_PUT] Financial transaction data prepared", { count: ftData.length, first: ftData[0] })

        await tx.financialTransaction.createMany({
          data: ftData,
        })
        
        console.log("[JOBCARDS_ID_PUT] Financial transactions created successfully")
      }
      return tx.jobCard.findUnique({
        where: { id },
        include: {
          customer: true,
          vehicle: true,
          serviceDescriptions: true,
          sparePartsBills: true,
          employeeEarnings: true,
          financialTransactions: true,
        },
      })
    })

    const transitionedToCompleted =
      existing.jobcardStatus !== "Completed" && String(jobcardStatus || "").trim() === "Completed"

    if (updated && transitionedToCompleted) {
      await createRoleNotifications(["admin", "manager"], {
        title: "Job Card Completed",
        body: `${updated.jobCardNumber} marked completed for ${updated.vehicle?.registrationNumber || "Unknown vehicle"}`,
        targetForm: "delivered",
        url: `/?form=delivered&jobCardId=${encodeURIComponent(updated.id)}`,
        type: "job_completed",
        refType: "jobcard",
        refId: updated.id,
      })

      // Notify customer on WhatsApp when their vehicle service is completed
      const customerMobile = updated.customer?.mobileNo
      if (customerMobile) {
        await sendMetaWhatsappJobCardNotification({
          mobile: customerMobile,
          customerName: updated.customer?.name || "Customer",
          vehicleNumber: updated.vehicle?.registrationNumber || "",
          status: "Service Completed",
          jobCardNumber: updated.jobCardNumber || updated.id,
        }).catch((err) => console.error("[JOBCARD_WA_NOTIFY]", err))
      }
    }

    if (updated && (newlyAssignedEmployeeIds.length > 0 || removedEmployeeIds.length > 0)) {
      try {
        // Build quick-lookup maps (empId → task/amount) from incoming form data
        const incomingEmployeeByNormName = new Map(
          incomingEmployees.map((e) => [normalizePersonName(e.empName), e.employeeId])
        )
        const taskByEmployeeId = new Map(
          safeTechnicians
            .map((item) => {
              const empId = incomingEmployeeByNormName.get(normalizePersonName(item.employeeName))
              return empId !== undefined ? ([empId, (item.taskAssigned || "").trim()] as [number, string]) : null
            })
            .filter((x): x is [number, string] => x !== null)
        )
        const amountByEmployeeId = new Map(
          safeTechnicians
            .map((item) => {
              const empId = incomingEmployeeByNormName.get(normalizePersonName(item.employeeName))
              return empId !== undefined ? ([empId, Number(item.allocationAmount || 0)] as [number, number]) : null
            })
            .filter((x): x is [number, number] => x !== null)
        )

        if (newlyAssignedEmployeeIds.length > 0) {
          await prisma.technicianAllocation.createMany({
            data: newlyAssignedEmployeeIds.map((empId) => ({
              jobId: updated.id,
              employeeId: empId,
              status: "assigned",
              earningAmount: amountByEmployeeId.get(empId) || 0,
              taskAssigned: taskByEmployeeId.get(empId) || "",
              assignedAt: new Date(),
            })),
            skipDuplicates: true,
          })
        }

        if (removedEmployeeIds.length > 0) {
          await prisma.technicianAllocation.deleteMany({
            where: {
              jobId: updated.id,
              employeeId: { in: removedEmployeeIds },
              status: { in: ["assigned", "accepted", "in_progress"] },
            },
          })
        }

        const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000"

        if (newlyAssignedEmployeeIds.length > 0) {
          await Promise.allSettled(
            newlyAssignedEmployeeIds.map((empId) =>
              sendJobAssignmentNotification(
                empId,
                {
                  jobId: updated.id,
                  vehicleNumber: updated.vehicle?.registrationNumber || "Unknown vehicle",
                  customerName: updated.customer?.name || undefined,
                  taskAssigned: taskByEmployeeId.get(empId) || undefined,
                },
                serverUrl
              )
            )
          )
        }

        if (removedEmployeeIds.length > 0) {
          await sendJobReassignedNotifications(
            removedEmployeeIds,
            {
              jobId: updated.id,
              vehicleNumber: updated.vehicle?.registrationNumber || "Unknown vehicle",
              customerName: updated.customer?.name || undefined,
            },
            serverUrl
          )
        }
      } catch (notificationError) {
        console.error("[JOBCARDS_ID_PUT] Failed to send technician allocation notifications", notificationError)
      }
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error("[JOBCARDS_ID_PUT]", error)
    const message = error instanceof Error ? error.message : "Failed to update jobcard"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await prisma.jobCard.findUnique({
      where: { id },
      include: {
        vehicle: true,
        customer: true,
        employeeEarnings: {
          select: {
            employee: true,
          },
        },
        technicianAllocations: {
          select: {
            employeeId: true,
            status: true,
          },
        },
      },
    })
    if (!existing) {
      return NextResponse.json({ error: "JobCard not found" }, { status: 404 })
    }

    const activeAllocationEmployeeIds = existing.technicianAllocations
      .filter((allocation) =>
        ["assigned", "accepted", "in_progress"].includes(allocation.status)
      )
      .map((allocation) => allocation.employeeId)

    const employeeNamesFromEarnings = Array.from(
      new Set(
        existing.employeeEarnings
          .map((item) => (item.employee || "").trim())
          .filter(Boolean)
      )
    )

    const earningsEmployees = employeeNamesFromEarnings.length
      ? await prisma.employee.findMany({
          where: {
            isTechnician: true,
            isArchived: false,
            empName: {
              in: employeeNamesFromEarnings,
            },
          },
          select: {
            employeeId: true,
          },
        })
      : []

    const techniciansToNotify = Array.from(
      new Set([
        ...activeAllocationEmployeeIds,
        ...earningsEmployees.map((employee) => employee.employeeId),
      ])
    )

    await prisma.jobCard.delete({ where: { id } })

    if (techniciansToNotify.length > 0) {
      const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000"
      await sendJobDeletedNotifications(
        techniciansToNotify,
        {
          jobId: id,
          vehicleNumber: existing.vehicle?.registrationNumber || "Unknown vehicle",
          customerName: existing.customer?.name || undefined,
        },
        serverUrl
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[JOBCARDS_ID_DELETE]", error)
    return NextResponse.json({ error: "Failed to delete jobcard" }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const { vehicleStatus, jobcardPaymentStatus } = body

    if (!vehicleStatus && !jobcardPaymentStatus) {
      return NextResponse.json(
        { error: "Either vehicleStatus or jobcardPaymentStatus is required" },
        { status: 400 }
      )
    }

    const updateData: any = {}
    if (vehicleStatus) updateData.vehicleStatus = vehicleStatus
    if (jobcardPaymentStatus) updateData.jobcardPaymentStatus = jobcardPaymentStatus

    const existing = await prisma.jobCard.findUnique({
      where: { id },
      select: { vehicleStatus: true, jobCardNumber: true },
    })

    const updated = await prisma.jobCard.update({
      where: { id },
      data: updateData,
      include: {
        customer: true,
        vehicle: true,
        serviceDescriptions: true,
        sparePartsBills: true,
        employeeEarnings: true,
      },
    })

    // Notify customer on WhatsApp when vehicle status changes to Ready or Delivered
    const statusChanged = vehicleStatus && existing?.vehicleStatus !== vehicleStatus
    if (statusChanged && (vehicleStatus === "Ready" || vehicleStatus === "Delivered")) {
      const customerMobile = updated.customer?.mobileNo
      if (customerMobile) {
        const statusLabel = vehicleStatus === "Ready" ? "Ready for Pickup" : "Delivered"
        sendMetaWhatsappJobCardNotification({
          mobile: customerMobile,
          customerName: updated.customer?.name || "Customer",
          vehicleNumber: updated.vehicle?.registrationNumber || "",
          status: statusLabel,
          jobCardNumber: updated.jobCardNumber || updated.id,
        }).catch((err) => console.error("[JOBCARD_WA_NOTIFY_PATCH]", err))
      }
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error("[JOBCARDS_ID_PATCH]", error)
    const message = error instanceof Error ? error.message : "Failed to update jobcard"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

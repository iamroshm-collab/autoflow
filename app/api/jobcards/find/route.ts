import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const normalizeMobile = (value: string) => value.replace(/\D/g, "")
const normalizeRegistration = (value: string) =>
  value.replace(/[^A-Z0-9]/gi, "").toUpperCase()

const deriveApplyToAndDescription = (rawDescription: string | null) => {
  const text = (rawDescription || "").trim()
  if (!text) {
    return { applyTo: "", description: "" }
  }

  const knownApplyTo = ["Bill Payment", "Advance Payment", "Personal Expense", "Salary"]
  for (const value of knownApplyTo) {
    if (text === value) {
      return { applyTo: value, description: "" }
    }
    if (text.startsWith(`${value}:`)) {
      return { applyTo: value, description: text.slice(value.length + 1).trim() }
    }
  }

  const firstColon = text.indexOf(":")
  if (firstColon > 0) {
    return {
      applyTo: text.slice(0, firstColon).trim(),
      description: text.slice(firstColon + 1).trim(),
    }
  }

  return { applyTo: "", description: text }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get("id")?.trim() || ""
    const fileNo = searchParams.get("fileNo")?.trim() || ""
    const mobileNo = searchParams.get("mobileNo")?.trim() || ""
    const registrationNumber =
      searchParams.get("registrationNumber")?.trim().toUpperCase() || ""

    if (!id && !fileNo && !mobileNo && !registrationNumber) {
      return NextResponse.json(
        { error: "Provide File No, Mobile No, or Registration Number" },
        { status: 400 }
      )
    }

    if (id) {
      const jobCardById = await prisma.jobCard.findUnique({
        where: { id },
        include: {
          customer: {
            select: {
              id: true,
              mobileNo: true,
              name: true,
            },
          },
          vehicle: {
            select: {
              id: true,
              registrationNumber: true,
              make: true,
              model: true,
            },
          },
          sparePartsBills: {
            orderBy: { sl: "asc" },
            select: {
              id: true,
              shopName: true,
              billDate: true,
              billNumber: true,
              itemDescription: true,
              returnedItem: true,
              amount: true,
              billReturned: true,
              returnedDate: true,
              returnAmount: true,
            },
          },
          serviceDescriptions: {
            orderBy: { sl: "asc" },
          },
          employeeEarnings: {
            orderBy: { sl: "asc" },
            select: {
              id: true,
              employee: true,
              employeeID: true,
              amount: true,
            },
          },
          financialTransactions: {
            orderBy: { transactionDate: "asc" },
            select: {
              id: true,
              transactionType: true,
              transactionDate: true,
              paymentType: true,
              transactionAmount: true,
              description: true,
            },
          },
        },
      })

      if (!jobCardById) {
        return NextResponse.json({ error: "JobCard not found" }, { status: 404 })
      }

      const sparesById = jobCardById.sparePartsBills.map((item) => ({
        id: item.id,
        shopName: item.shopName || "",
        billDate: item.billDate,
        billNumber: item.billNumber || "",
        item: item.itemDescription || "",
        returnedItem: item.returnedItem || "",
        amount: Number(item.amount || 0),
        isReturn: Boolean(item.billReturned),
        returnDate: item.returnedDate,
        returnAmount: Number(item.returnAmount || 0),
      }))

      const servicesById = jobCardById.serviceDescriptions.map((item) => ({
        id: item.id,
        description: item.description || "",
        unit: item.unit || "",
        quantity: Number(item.qnty || 1),
        amount: Number(item.amount || 0),
        cgstRate: Number((item as any).cgstRate || 0),
        cgstAmount: Number((item as any).cgstAmount || 0),
        sgstRate: Number((item as any).sgstRate || 0),
        sgstAmount: Number((item as any).sgstAmount || 0),
        igstRate: Number((item as any).igstRate || 0),
        igstAmount: Number((item as any).igstAmount || 0),
        totalAmount: Number((item as any).totalAmount || 0),
        stateId: (item as any).stateId ?? "",
      }))

      const techniciansById = jobCardById.employeeEarnings.map((item: any) => ({
        id: item.id,
        employeeName: item.employee || "",
        workType: item.workType || "Mechanical",
        taskAssigned: item.employeeID || "",
        allocationAmount: Number(item.amount || 0),
      }))

      const financialTransactionsById = jobCardById.financialTransactions.map((item) => {
        const parsed = deriveApplyToAndDescription(item.description)
        return {
          id: item.id,
          transactionType: item.transactionType || "",
          transactionDate: item.transactionDate,
          paymentType: item.paymentType || "",
          applyTo: parsed.applyTo,
          transactionAmount: Number(item.transactionAmount || 0),
          description: parsed.description,
        }
      })

      return NextResponse.json({
        ...jobCardById,
        discount: Number((jobCardById as any).discount || 0),
        spares: sparesById,
        services: servicesById,
        technicians: techniciansById,
        financialTransactions: financialTransactionsById,
      })
    }

    const orFilters: any[] = []

    if (fileNo) {
      orFilters.push({ fileNo })
    }

    if (mobileNo) {
      orFilters.push({
        customer: {
          is: {
            mobileNo,
          },
        },
      })
    }

    if (registrationNumber) {
      orFilters.push({
        vehicle: {
          is: {
            registrationNumber,
          },
        },
      })
    }

    const whereClause = {
      OR: orFilters,
    }

    let jobCard = await prisma.jobCard.findFirst({
      where: whereClause,
      include: {
        customer: {
          select: {
            id: true,
            mobileNo: true,
            name: true,
          },
        },
        vehicle: {
          select: {
            id: true,
            registrationNumber: true,
            make: true,
            model: true,
          },
        },
        sparePartsBills: {
          orderBy: { sl: "asc" },
          select: {
            id: true,
            shopName: true,
            billDate: true,
            billNumber: true,
            itemDescription: true,
            returnedItem: true,
            amount: true,
            billReturned: true,
            returnedDate: true,
            returnAmount: true,
          },
        },
        serviceDescriptions: {
            orderBy: { sl: "asc" },
          },
        employeeEarnings: {
          orderBy: { sl: "asc" },
          select: {
            id: true,
            employee: true,
            employeeID: true,
            amount: true,
          },
        },
        financialTransactions: {
          orderBy: { transactionDate: "asc" },
          select: {
            id: true,
            transactionType: true,
            transactionDate: true,
            paymentType: true,
            transactionAmount: true,
            description: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    })

    // Fallback: flexible matching for user-entered formats
    // - mobile with spaces/symbols
    // - registration with/without hyphens/spaces
    // - file no partial match or job card number match
    if (!jobCard) {
      const normalizedMobile = normalizeMobile(mobileNo)
      const normalizedReg = normalizeRegistration(registrationNumber)
      const normalizedFile = fileNo.toLowerCase()

      const candidates = await prisma.jobCard.findMany({
        include: {
          customer: {
            select: {
              id: true,
              mobileNo: true,
              name: true,
            },
          },
          vehicle: {
            select: {
              id: true,
              registrationNumber: true,
              make: true,
              model: true,
            },
          },
          sparePartsBills: {
            orderBy: { sl: "asc" },
            select: {
              id: true,
              shopName: true,
              billDate: true,
              billNumber: true,
              itemDescription: true,
              returnedItem: true,
              amount: true,
              billReturned: true,
              returnedDate: true,
              returnAmount: true,
            },
          },
          serviceDescriptions: {
            orderBy: { sl: "asc" },
          },
          employeeEarnings: {
            orderBy: { sl: "asc" },
            select: {
              id: true,
              employee: true,
              employeeID: true,
              amount: true,
            },
          },
          financialTransactions: {
            orderBy: { transactionDate: "asc" },
            select: {
              id: true,
              transactionType: true,
              transactionDate: true,
              paymentType: true,
              transactionAmount: true,
              description: true,
            },
          },
        },
        orderBy: {
          updatedAt: "desc",
        },
        take: 200,
      })

      jobCard =
        candidates.find((item) => {
          const fileMatch = fileNo
            ? item.fileNo?.toLowerCase() === normalizedFile ||
              item.fileNo?.toLowerCase().includes(normalizedFile) ||
              item.jobCardNumber?.toLowerCase() === normalizedFile ||
              item.jobCardNumber?.toLowerCase().includes(normalizedFile)
            : false

          const mobileMatch = mobileNo
            ? normalizeMobile(item.customer.mobileNo) === normalizedMobile
            : false

          const regMatch = registrationNumber
            ? normalizeRegistration(item.vehicle.registrationNumber) === normalizedReg
            : false

          return fileMatch || mobileMatch || regMatch
        }) || null
    }

    if (!jobCard) {
      return NextResponse.json({ error: "JobCard not found" }, { status: 404 })
    }

    const spares = jobCard.sparePartsBills.map((item) => ({
      id: item.id,
      shopName: item.shopName || "",
      billDate: item.billDate,
      billNumber: item.billNumber || "",
      item: item.itemDescription || "",
      returnedItem: item.returnedItem || "",
      amount: Number(item.amount || 0),
      isReturn: Boolean(item.billReturned),
      returnDate: item.returnedDate,
      returnAmount: Number(item.returnAmount || 0),
    }))

    const services = jobCard.serviceDescriptions.map((item) => ({
      id: item.id,
      description: item.description || "",
      unit: item.unit || "",
      quantity: Number(item.qnty || 1),
      amount: Number(item.amount || 0),
      cgstRate: Number((item as any).cgstRate || 0),
      cgstAmount: Number((item as any).cgstAmount || 0),
      sgstRate: Number((item as any).sgstRate || 0),
      sgstAmount: Number((item as any).sgstAmount || 0),
      igstRate: Number((item as any).igstRate || 0),
      igstAmount: Number((item as any).igstAmount || 0),
      totalAmount: Number((item as any).totalAmount || 0),
      stateId: (item as any).stateId ?? "",
    }))

    const technicians = jobCard.employeeEarnings.map((item: any) => ({
      id: item.id,
      employeeName: item.employee || "",
      workType: item.workType || "Mechanical",
      taskAssigned: item.employeeID || "",
      allocationAmount: Number(item.amount || 0),
    }))

    const financialTransactions = jobCard.financialTransactions.map((item) => {
      const parsed = deriveApplyToAndDescription(item.description)
      return {
        id: item.id,
        transactionType: item.transactionType || "",
        transactionDate: item.transactionDate,
        paymentType: item.paymentType || "",
        applyTo: parsed.applyTo,
        transactionAmount: Number(item.transactionAmount || 0),
        description: parsed.description,
      }
    })

    return NextResponse.json({
      ...jobCard,
      discount: Number((jobCard as any).discount || 0),
      spares,
      services,
      technicians,
      financialTransactions,
    })
  } catch (error) {
    console.error("[JOBCARDS_FIND_GET]", error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

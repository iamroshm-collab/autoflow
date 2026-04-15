import { prisma } from "@/lib/prisma"
import { isAdminLikeDesignation, normalizeAttendanceCode } from "@/lib/attendance"
import {
  calculateOvertimeFromPolicy,
  deriveAttendancePercentageFromPolicy,
  deriveAttendanceStatusFromPolicy,
  getOrCreateAttendancePolicy,
  getSalaryMultiplierFromPolicy,
} from "@/lib/attendance-policy"

type GeneratedPayroll = Awaited<ReturnType<typeof prisma.monthlyPayroll.create>>

export async function generateMonthlyPayrollData(
  monthNum: number,
  yearNum: number,
  generatedBy?: string | null
): Promise<{ count: number; payrolls: GeneratedPayroll[] }> {
  const policy = await getOrCreateAttendancePolicy()
  const leaveTypes = await (prisma as any).leaveType.findMany({ where: { isActive: true } })
  const leavePaidPercentageByCode = new Map<string, number>()
  leaveTypes.forEach((leaveType: any) => {
    leavePaidPercentageByCode.set(
      String(leaveType.leaveCode || "").trim().toUpperCase(),
      Math.max(0, Math.min(100, Number(leaveType.paidPercentage || 0)))
    )
  })

  // Get all active employees
  const employees = await prisma.$queryRaw<Array<{
    employeeId: number
    empName: string
    designation: string | null
    salaryPerday: number
    monthlySalary: number
    perDaySalary: number
    workingDaysInMonth: number
    houseRentAllowance: number
    dearnessAllowance: number
    conveyanceAllowance: number
    medicalAllowance: number
    specialAllowance: number
    travelAllowance: number
    internetAllowance: number
    otherAllowance: number
    isAttendanceEligible: boolean
  }>>`
    SELECT
      "employeeId",
      "empName",
      "designation",
      "salaryPerday",
      "monthly_salary" AS "monthlySalary",
      "per_day_salary" AS "perDaySalary",
      "working_days_in_month" AS "workingDaysInMonth",
      "house_rent_allowance" AS "houseRentAllowance",
      "dearness_allowance" AS "dearnessAllowance",
      "conveyance_allowance" AS "conveyanceAllowance",
      "medical_allowance" AS "medicalAllowance",
      "special_allowance" AS "specialAllowance",
      "travel_allowance" AS "travelAllowance",
      "internet_allowance" AS "internetAllowance",
      "other_allowance" AS "otherAllowance",
      "isAttendanceEligible"
    FROM "Employee"
    WHERE "isArchived" = false
  `

  const startDate = new Date(yearNum, monthNum - 1, 1)
  const endDate = new Date(yearNum, monthNum, 0)
  endDate.setHours(23, 59, 59, 999)

  const payrollResults: GeneratedPayroll[] = []

  for (const employee of employees) {
    if (employee.isAttendanceEligible === false || isAdminLikeDesignation(employee.designation)) {
      continue
    }

    const attendanceRecords = await prisma.$queryRaw<Array<{ attendance: string; workedMinutes: number | null }>>`
      SELECT "attendance", "workedMinutes"
      FROM "AttendancePayroll"
      WHERE "employeeId" = ${employee.employeeId}
        AND "attendanceDate" >= ${startDate}
        AND "attendanceDate" <= ${endDate}
    `

    let totalPresent = 0
    let totalHalfDay = 0
    let totalLeave = 0
    let totalAbsent = 0
    let salaryDays = 0
    let totalOvertimePay = 0

    const perDaySalary = Number(employee.perDaySalary || employee.salaryPerday || 0)
    const monthlySalary = Number(employee.monthlySalary || 0)
    const fixedAllowances =
      Number(employee.houseRentAllowance || 0) +
      Number(employee.dearnessAllowance || 0) +
      Number(employee.conveyanceAllowance || 0) +
      Number(employee.medicalAllowance || 0) +
      Number(employee.specialAllowance || 0) +
      Number(employee.travelAllowance || 0) +
      Number(employee.internetAllowance || 0) +
      Number(employee.otherAllowance || 0)

    attendanceRecords.forEach((record) => {
      // If workedMinutes exists, derive payable percentage from policy rules; otherwise fallback to stored attendance value
      const derivedPercentage = record.workedMinutes != null
        ? deriveAttendancePercentageFromPolicy(record.workedMinutes, policy)
        : null
      let salaryMultiplier = derivedPercentage != null
        ? Math.max(0, Math.min(1, derivedPercentage / 100))
        : getSalaryMultiplierFromPolicy(record.attendance, policy)

      const leavePaidPercentage = leavePaidPercentageByCode.get(String(record.attendance || "").trim().toUpperCase())
      if (derivedPercentage == null && leavePaidPercentage != null) {
        salaryMultiplier = Math.max(0, Math.min(1, leavePaidPercentage / 100))
      }

      // Keep legacy attendance buckets for backward-compatible columns
      const code = derivedPercentage != null
        ? deriveAttendanceStatusFromPolicy(record.workedMinutes, policy)
        : normalizeAttendanceCode(record.attendance)

      // Accumulate legacy counters (for backwards-compatible payroll columns)
      if (code === "P") totalPresent += 1
      else if (code === "H" || code === "HPL") totalHalfDay += 1
      else if (code === "L" || code === "CL" || code === "AL" || code === "ML" || code === "EL") totalLeave += 1
      else if (code === "A") totalAbsent += 1

      // Salary days now come from attendance percentage configured in policy rules.
      salaryDays += salaryMultiplier

      // Overtime: minutes worked beyond threshold on days the employee was present
      if (salaryMultiplier > 0 && record.workedMinutes != null) {
        const overtime = calculateOvertimeFromPolicy(record.workedMinutes, policy)
        if (overtime.overtimeMinutes > 0) {
          totalOvertimePay += overtime.overtimeHours * (perDaySalary / 8) * overtime.multiplier
        }
      }
    })

    const adjustments = await prisma.adjustment.findMany({
      where: {
        employeeId: employee.employeeId,
        adjustmentDate: {
          gte: startDate,
          lte: endDate,
        },
      },
    })

    let totalAllowance = 0
    let totalIncentive = 0
    let totalAdvance = 0
    let totalDeduction = 0

    adjustments.forEach((adj) => {
      switch (adj.adjustmentType) {
        case "Allowance":
          totalAllowance += adj.amount
          break
        case "Incentive":
          totalIncentive += adj.amount
          break
        case "Advance":
          totalAdvance += adj.amount
          break
        case "Deduction":
        case "PF":
        case "ESI":
        case "Tax":
          totalDeduction += adj.amount
          break
        default:
          break
      }
    })

    const attendanceBasedFallback = salaryDays * perDaySalary
    const workingDaysInMonth = Math.max(0, Number(employee.workingDaysInMonth || 0))
    const payableRatio = workingDaysInMonth > 0
      ? Math.max(0, Math.min(1, salaryDays / workingDaysInMonth))
      : 0
    const payableBaseSalary = monthlySalary > 0
      ? (monthlySalary + fixedAllowances) * payableRatio
      : attendanceBasedFallback

    const basicSalary = Math.max(0, payableBaseSalary)
    const netSalaryRaw = basicSalary + totalOvertimePay + totalAllowance + totalIncentive - totalAdvance - totalDeduction
    const netSalary = Math.max(0, Math.round(netSalaryRaw))

    const payroll = await prisma.monthlyPayroll.upsert({
      where: {
        employeeId_month_year: {
          employeeId: employee.employeeId,
          month: monthNum,
          year: yearNum,
        },
      },
      update: {
        basicSalary,
        totalPresent,
        totalHalfDay,
        totalLeave,
        totalAbsent,
        totalAllowance,
        totalIncentive,
        totalAdvance,
        netSalary,
        generatedBy: generatedBy || null,
      },
      create: {
        employeeId: employee.employeeId,
        month: monthNum,
        year: yearNum,
        basicSalary,
        totalPresent,
        totalHalfDay,
        totalLeave,
        totalAbsent,
        totalAllowance,
        totalIncentive,
        totalAdvance,
        netSalary,
        generatedBy: generatedBy || null,
      },
    })

    payrollResults.push(payroll)
  }

  return {
    count: payrollResults.length,
    payrolls: payrollResults,
  }
}

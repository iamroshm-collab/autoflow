import { prisma } from "@/lib/prisma"
import { normalizeAttendanceCode } from "@/lib/attendance"

export type DurationOperator = "lt" | "gt" | "eq" | "lte" | "gte" | "between"

export interface PolicyHolidayRule {
  holiday_date: string
  holiday_name: string
  holiday_type: string
}

export interface AttendanceDurationRule {
  id: string
  operator: DurationOperator
  duration_minutes?: number
  min_minutes?: number
  max_minutes?: number
  payable_percentage: number
}

export interface OvertimeTierRule {
  id: string
  after_minutes: number
  multiplier: number
}

export interface LeaveTypeRule {
  id: string
  leave_name: string
  paid_percentage: number
  requires_approval: boolean
  deduct_from_balance: boolean
}

export interface AttendancePolicyConfig {
  policy_id?: string
  company_id: string
  holiday_rules: {
    sunday_auto_holiday: boolean
    holidays: PolicyHolidayRule[]
  }
  attendance_rules: AttendanceDurationRule[]
  overtime_rules: {
    overtime_start_duration_minutes: number
    tiers: OvertimeTierRule[]
  }
  leave_types: LeaveTypeRule[]
  leave_rules: {
    grant_compensatory_leave_on_holiday_work: boolean
    overtime_compensation_mode: "payment_or_comp_off" | "payment_only" | "comp_off_only"
  }
  work_duration_settings: {
    standard_work_hours: number
    break_duration_minutes: number
    maximum_work_hours: number
  }
  processing_logic: string[]
}

export const DEFAULT_ATTENDANCE_POLICY: AttendancePolicyConfig = {
  company_id: "default",
  holiday_rules: {
    sunday_auto_holiday: true,
    holidays: [],
  },
  attendance_rules: [
    {
      id: "present-rule",
      operator: "gte",
      duration_minutes: 8 * 60,
      payable_percentage: 100,
    },
    {
      id: "halfday-rule",
      operator: "between",
      min_minutes: 4 * 60,
      max_minutes: 8 * 60 - 1,
      payable_percentage: 50,
    },
    {
      id: "absent-rule",
      operator: "lt",
      duration_minutes: 4 * 60,
      payable_percentage: 0,
    },
  ],
  overtime_rules: {
    overtime_start_duration_minutes: 8 * 60,
    tiers: [
      { id: "ot-1", after_minutes: 8 * 60, multiplier: 1.5 },
      { id: "ot-2", after_minutes: 10 * 60, multiplier: 2 },
    ],
  },
  leave_types: [
    { id: "leave-al", leave_name: "Annual Leave", paid_percentage: 100, requires_approval: true, deduct_from_balance: true },
    { id: "leave-ml", leave_name: "Medical Leave", paid_percentage: 100, requires_approval: true, deduct_from_balance: true },
    { id: "leave-hpl", leave_name: "Half Pay Leave", paid_percentage: 50, requires_approval: true, deduct_from_balance: true },
    { id: "leave-col", leave_name: "Compensatory Leave", paid_percentage: 100, requires_approval: true, deduct_from_balance: true },
    { id: "leave-cl", leave_name: "Casual Leave", paid_percentage: 100, requires_approval: true, deduct_from_balance: true },
    { id: "leave-ul", leave_name: "Unpaid Leave", paid_percentage: 0, requires_approval: true, deduct_from_balance: false },
  ],
  leave_rules: {
    grant_compensatory_leave_on_holiday_work: true,
    overtime_compensation_mode: "payment_or_comp_off",
  },
  work_duration_settings: {
    standard_work_hours: 8,
    break_duration_minutes: 60,
    maximum_work_hours: 12,
  },
  processing_logic: [
    "Check holiday calendar",
    "Check approved leave",
    "Calculate work duration",
    "Apply attendance rules",
    "Apply overtime rules",
    "Apply leave rules",
  ],
}

const isObject = (value: unknown): value is Record<string, any> => {
  return typeof value === "object" && value != null && !Array.isArray(value)
}

export const resolveCompanyId = (input?: string | null) => {
  const normalized = String(input || "").trim()
  if (normalized) {
    return normalized
  }
  return String(process.env.ATTENDANCE_POLICY_COMPANY_ID || "default")
}

const toNumber = (value: unknown, fallback: number) => {
  const num = Number(value)
  if (!Number.isFinite(num)) {
    return fallback
  }
  return num
}

const legacyStatusToPercentage = (status: unknown) => {
  const normalized = String(status || "").trim().toUpperCase()
  if (normalized === "FD" || normalized === "P") return 100
  if (normalized === "H" || normalized === "HPL") return 50
  if (normalized === "PD") return 50
  if (normalized === "A" || normalized === "WO" || normalized === "PH") return 0
  if (normalized === "L" || normalized === "CL" || normalized === "AL" || normalized === "ML" || normalized === "EL") return 100
  return 0
}

export function mergeWithDefaultPolicy(rawPolicy: unknown, companyId?: string | null): AttendancePolicyConfig {
  const base: AttendancePolicyConfig = {
    ...DEFAULT_ATTENDANCE_POLICY,
    company_id: resolveCompanyId(companyId || DEFAULT_ATTENDANCE_POLICY.company_id),
  }

  if (!isObject(rawPolicy)) {
    return base
  }

  const holidayRules = isObject(rawPolicy.holiday_rules) ? rawPolicy.holiday_rules : {}
  const overtimeRules = isObject(rawPolicy.overtime_rules) ? rawPolicy.overtime_rules : {}
  const leaveRules = isObject(rawPolicy.leave_rules) ? rawPolicy.leave_rules : {}
  const workDurationSettings = isObject(rawPolicy.work_duration_settings) ? rawPolicy.work_duration_settings : {}

  return {
    policy_id: String(rawPolicy.policy_id || "") || undefined,
    company_id: resolveCompanyId(String(rawPolicy.company_id || "") || base.company_id),
    holiday_rules: {
      sunday_auto_holiday: Boolean(
        holidayRules.sunday_auto_holiday ?? base.holiday_rules.sunday_auto_holiday
      ),
      holidays: Array.isArray(holidayRules.holidays)
        ? holidayRules.holidays
            .filter((item) => isObject(item) && String(item.holiday_date || "").trim())
            .map((item) => ({
              holiday_date: String(item.holiday_date || "").trim(),
              holiday_name: String(item.holiday_name || "Holiday").trim() || "Holiday",
              holiday_type: String(item.holiday_type || "public").trim() || "public",
            }))
        : base.holiday_rules.holidays,
    },
    attendance_rules: Array.isArray(rawPolicy.attendance_rules)
      ? rawPolicy.attendance_rules
          .filter((item) => isObject(item))
          .map((item, index) => ({
            id: String(item.id || `rule-${index + 1}`),
            operator: ["lt", "gt", "eq", "lte", "gte", "between"].includes(String(item.operator || ""))
              ? (String(item.operator) as DurationOperator)
              : "gte",
            duration_minutes:
              item.duration_minutes == null ? undefined : Math.max(0, Math.floor(toNumber(item.duration_minutes, 0))),
            min_minutes: item.min_minutes == null ? undefined : Math.max(0, Math.floor(toNumber(item.min_minutes, 0))),
            max_minutes: item.max_minutes == null ? undefined : Math.max(0, Math.floor(toNumber(item.max_minutes, 0))),
            payable_percentage: Math.max(
              0,
              Math.min(
                100,
                toNumber(
                  item.payable_percentage,
                  item.status_result != null
                    ? legacyStatusToPercentage(item.status_result)
                    : 0
                )
              )
            ),
          }))
      : base.attendance_rules,
    overtime_rules: {
      overtime_start_duration_minutes: Math.max(
        0,
        Math.floor(
          toNumber(
            overtimeRules.overtime_start_duration_minutes,
            base.overtime_rules.overtime_start_duration_minutes
          )
        )
      ),
      tiers: Array.isArray(overtimeRules.tiers)
        ? overtimeRules.tiers
            .filter((item) => isObject(item))
            .map((item, index) => ({
              id: String(item.id || `tier-${index + 1}`),
              after_minutes: Math.max(0, Math.floor(toNumber(item.after_minutes, 0))),
              multiplier: toNumber(item.multiplier, 1),
            }))
            .sort((a, b) => a.after_minutes - b.after_minutes)
        : base.overtime_rules.tiers,
    },
    leave_types: Array.isArray(rawPolicy.leave_types)
      ? rawPolicy.leave_types
          .filter((item) => isObject(item))
          .map((item, index) => ({
            id: String(item.id || `leave-${index + 1}`),
            leave_name: String(item.leave_name || "Leave").trim() || "Leave",
            paid_percentage: Math.min(100, Math.max(0, toNumber(item.paid_percentage, 100))),
            requires_approval: Boolean(item.requires_approval),
            deduct_from_balance: Boolean(item.deduct_from_balance),
          }))
      : base.leave_types,
    leave_rules: {
      grant_compensatory_leave_on_holiday_work: Boolean(
        leaveRules.grant_compensatory_leave_on_holiday_work ?? base.leave_rules.grant_compensatory_leave_on_holiday_work
      ),
      overtime_compensation_mode:
        leaveRules.overtime_compensation_mode === "payment_only" ||
        leaveRules.overtime_compensation_mode === "comp_off_only" ||
        leaveRules.overtime_compensation_mode === "payment_or_comp_off"
          ? leaveRules.overtime_compensation_mode
          : base.leave_rules.overtime_compensation_mode,
    },
    work_duration_settings: {
      standard_work_hours: Math.max(0, toNumber(workDurationSettings.standard_work_hours, base.work_duration_settings.standard_work_hours)),
      break_duration_minutes: Math.max(
        0,
        Math.floor(toNumber(workDurationSettings.break_duration_minutes, base.work_duration_settings.break_duration_minutes))
      ),
      maximum_work_hours: Math.max(
        0,
        toNumber(workDurationSettings.maximum_work_hours, base.work_duration_settings.maximum_work_hours)
      ),
    },
    processing_logic: Array.isArray(rawPolicy.processing_logic)
      ? rawPolicy.processing_logic.map((step) => String(step || "")).filter(Boolean)
      : base.processing_logic,
  }
}

export async function getOrCreateAttendancePolicy(companyIdInput?: string | null): Promise<AttendancePolicyConfig> {
  const companyId = resolveCompanyId(companyIdInput)
  const existing = await prisma.attendancePolicy.findUnique({ where: { companyId } })
  if (existing) {
    return mergeWithDefaultPolicy(existing.policy, existing.companyId)
  }

  const defaultPolicy = mergeWithDefaultPolicy({ ...DEFAULT_ATTENDANCE_POLICY, company_id: companyId }, companyId)

  try {
    const created = await prisma.attendancePolicy.create({
      data: {
        companyId,
        policy: defaultPolicy as any,
      },
    })
    return mergeWithDefaultPolicy(created.policy, created.companyId)
  } catch {
    const fallback = await prisma.attendancePolicy.findUnique({ where: { companyId } })
    if (fallback) {
      return mergeWithDefaultPolicy(fallback.policy, fallback.companyId)
    }
    return defaultPolicy
  }
}

export async function saveAttendancePolicy(params: {
  companyId?: string | null
  policy: unknown
  changedBy: string
}) {
  const companyId = resolveCompanyId(params.companyId)
  const normalizedPolicy = mergeWithDefaultPolicy(params.policy, companyId)

  return prisma.$transaction(async (tx) => {
    const existing = await tx.attendancePolicy.findUnique({ where: { companyId } })

    const updated = await tx.attendancePolicy.upsert({
      where: { companyId },
      update: { policy: normalizedPolicy as any },
      create: { companyId, policy: normalizedPolicy as any },
    })

    await tx.attendancePolicyAuditLog.create({
      data: {
        policyId: updated.policyId,
        changedBy: params.changedBy,
        oldValue: (existing?.policy as any) ?? null,
        newValue: normalizedPolicy as any,
      },
    })

    return mergeWithDefaultPolicy(updated.policy, updated.companyId)
  })
}

const evaluateOperator = (valueMinutes: number, rule: AttendanceDurationRule) => {
  const target = Number(rule.duration_minutes || 0)
  const min = Number(rule.min_minutes || 0)
  const max = Number(rule.max_minutes || 0)

  switch (rule.operator) {
    case "lt":
      return valueMinutes < target
    case "gt":
      return valueMinutes > target
    case "eq":
      return valueMinutes === target
    case "lte":
      return valueMinutes <= target
    case "gte":
      return valueMinutes >= target
    case "between":
      return valueMinutes >= Math.min(min, max) && valueMinutes <= Math.max(min, max)
    default:
      return false
  }
}

export function deriveAttendanceStatusFromPolicy(
  workedMinutes: number | null | undefined,
  policy: AttendancePolicyConfig
) {
  const percentage = deriveAttendancePercentageFromPolicy(workedMinutes, policy)
  if (percentage >= 100) return "FD"
  if (percentage <= 0) return "A"
  if (percentage === 50) return "H"
  return "PD"
}

export function deriveAttendancePercentageFromPolicy(
  workedMinutes: number | null | undefined,
  policy: AttendancePolicyConfig
) {
  const safeWorkedMinutes = Math.max(0, Number(workedMinutes || 0))

  for (const rule of policy.attendance_rules) {
    if (evaluateOperator(safeWorkedMinutes, rule)) {
      return Math.max(0, Math.min(100, Number(rule.payable_percentage || 0)))
    }
  }

  return 0
}

export function isHolidayFromPolicy(dateIso: string, policy: AttendancePolicyConfig) {
  const normalizedDate = String(dateIso || "").trim()
  if (!normalizedDate) {
    return false
  }

  const holidays = policy.holiday_rules.holidays || []
  if (holidays.some((item) => item.holiday_date === normalizedDate)) {
    return true
  }

  if (policy.holiday_rules.sunday_auto_holiday) {
    const date = new Date(`${normalizedDate}T00:00:00`)
    if (!Number.isNaN(date.getTime()) && date.getDay() === 0) {
      return true
    }
  }

  return false
}

export function getHolidayNameFromPolicy(dateIso: string, policy: AttendancePolicyConfig) {
  const holiday = policy.holiday_rules.holidays.find((item) => item.holiday_date === dateIso)
  if (holiday) {
    return holiday.holiday_name
  }

  if (policy.holiday_rules.sunday_auto_holiday) {
    const date = new Date(`${dateIso}T00:00:00`)
    if (!Number.isNaN(date.getTime()) && date.getDay() === 0) {
      return "Sunday"
    }
  }

  return "Holiday"
}

export function calculateOvertimeFromPolicy(
  workedMinutes: number | null | undefined,
  policy: AttendancePolicyConfig
) {
  const totalWorked = Math.max(0, Number(workedMinutes || 0))
  const threshold = Math.max(0, Number(policy.overtime_rules.overtime_start_duration_minutes || 0))
  if (totalWorked <= threshold) {
    return {
      overtimeMinutes: 0,
      overtimeHours: 0,
      multiplier: 1,
    }
  }

  const overtimeMinutes = totalWorked - threshold

  let multiplier = 1
  const sortedTiers = [...policy.overtime_rules.tiers].sort((a, b) => a.after_minutes - b.after_minutes)
  sortedTiers.forEach((tier) => {
    if (totalWorked > tier.after_minutes) {
      multiplier = tier.multiplier
    }
  })

  return {
    overtimeMinutes,
    overtimeHours: overtimeMinutes / 60,
    multiplier,
  }
}

const normalizeLeaveName = (value: string) => {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ")
}

export function getSalaryMultiplierFromPolicy(statusCode: string, policy: AttendancePolicyConfig) {
  const percentMatch = String(statusCode || "").trim().match(/^(\d+(?:\.\d+)?)\s*%$/)
  if (percentMatch) {
    const percentage = Math.max(0, Math.min(100, Number(percentMatch[1] || 0)))
    return percentage / 100
  }

  const code = normalizeAttendanceCode(statusCode)

  if (code === "FD" || code === "P") return 1
  if (code === "H") return 0.5
  if (code === "PD") return 0.5
  if (code === "A" || code === "WO" || code === "PH") return 0
  if (code === "HPL") return 0.5

  const codeToKeyword: Record<string, string[]> = {
    CL: ["casual leave"],
    SL: ["sick leave"],
    AL: ["annual leave"],
    ML: ["medical leave"],
    MED: ["medical leave"],
    PL: ["privilege leave"],
    PLT: ["paternity leave"],
    CO: ["compensatory leave"],
    EL: ["earned leave"],
    LWP: ["leave without pay"],
    L: ["leave"],
  }

  const keywords = codeToKeyword[code] || []
  if (keywords.length > 0) {
    const matchedLeave = policy.leave_types.find((leaveType) => {
      const leaveName = normalizeLeaveName(leaveType.leave_name)
      return keywords.some((keyword) => leaveName.includes(keyword))
    })
    if (matchedLeave) {
      return Math.max(0, Math.min(1, Number(matchedLeave.paid_percentage || 0) / 100))
    }
  }

  const fallbackMultiplier: Record<string, number> = {
    L: 1,
    CL: 1,
    SL: 1,
    AL: 1,
    ML: 1,
    MED: 1,
    PL: 1,
    PLT: 1,
    CO: 1,
    EL: 1,
    LWP: 0,
  }

  return fallbackMultiplier[code] ?? 0
}

export function runAttendancePolicyPreview(params: {
  checkInTime: string
  checkOutTime: string
  policy: AttendancePolicyConfig
  isHoliday?: boolean
  hasApprovedLeave?: boolean
}) {
  const checkIn = new Date(params.checkInTime)
  const checkOut = new Date(params.checkOutTime)
  if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime()) || checkOut <= checkIn) {
    return {
      error: "Invalid check-in/check-out time",
    }
  }

  const workedMinutes = Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / 60000))

  if (params.hasApprovedLeave) {
    return {
      workedMinutes,
      attendanceStatus: "L",
      attendancePercentage: 100,
      overtimeHours: 0,
      overtimeMultiplier: 1,
      leaveDeduction: 0,
      compOffGranted: false,
    }
  }

  const overtime = calculateOvertimeFromPolicy(workedMinutes, params.policy)
  const attendancePercentage = deriveAttendancePercentageFromPolicy(workedMinutes, params.policy)
  const attendanceStatus = deriveAttendanceStatusFromPolicy(workedMinutes, params.policy)

  const compOffGranted = Boolean(
    params.isHoliday &&
      workedMinutes > 0 &&
      params.policy.leave_rules.grant_compensatory_leave_on_holiday_work
  )

  const leaveDeduction = compOffGranted
    ? 0
    : 1 - attendancePercentage / 100

  return {
    workedMinutes,
    attendanceStatus,
    attendancePercentage,
    overtimeHours: overtime.overtimeHours,
    overtimeMultiplier: overtime.multiplier,
    leaveDeduction,
    compOffGranted,
  }
}

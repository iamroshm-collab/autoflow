export interface PayrollComponentInput {
  basic_salary?: number
  house_rent_allowance?: number
  dearness_allowance?: number
  conveyance_allowance?: number
  medical_allowance?: number
  special_allowance?: number
  travel_allowance?: number
  internet_allowance?: number
  other_allowance?: number
  gross_salary?: number
  monthly_salary?: number
  per_day_salary?: number
  working_days_in_month?: number
  pf_applicable?: number
  esi_applicable?: number
  professional_tax_applicable?: number
  basicSalary?: number
  houseRentAllowance?: number
  dearnessAllowance?: number
  conveyanceAllowance?: number
  medicalAllowance?: number
  specialAllowance?: number
  travelAllowance?: number
  internetAllowance?: number
  otherAllowance?: number
  grossSalary?: number
  monthlySalary?: number
  perDaySalary?: number
  workingDaysInMonth?: number
  pfApplicable?: number
  esiApplicable?: number
  professionalTaxApplicable?: number
  salaryPerday?: number
}

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return parsed
}

const round2 = (value: number) => Math.round(value * 100) / 100

export function computeEmployeePayrollFields(input: PayrollComponentInput = {}) {
  const workingDaysInMonth = Math.max(
    1,
    Math.floor(toNumber(input.workingDaysInMonth ?? input.working_days_in_month, 26) || 26)
  )

  const monthlySalary = Math.max(0, toNumber(input.monthlySalary ?? input.monthly_salary, 0))
  const manualPerDay = Math.max(0, toNumber(input.perDaySalary ?? input.per_day_salary ?? input.salaryPerday, 0))
  const perDaySalary = monthlySalary > 0 ? round2(monthlySalary / workingDaysInMonth) : manualPerDay

  const basicSalary = Math.max(0, toNumber(input.basicSalary ?? input.basic_salary, 0))
  const houseRentAllowance = Math.max(0, toNumber(input.houseRentAllowance ?? input.house_rent_allowance, 0))
  const dearnessAllowance = Math.max(0, toNumber(input.dearnessAllowance ?? input.dearness_allowance, 0))
  const conveyanceAllowance = Math.max(0, toNumber(input.conveyanceAllowance ?? input.conveyance_allowance, 0))
  const medicalAllowance = Math.max(0, toNumber(input.medicalAllowance ?? input.medical_allowance, 0))
  const specialAllowance = Math.max(0, toNumber(input.specialAllowance ?? input.special_allowance, 0))
  const travelAllowance = Math.max(0, toNumber(input.travelAllowance ?? input.travel_allowance, 0))
  const internetAllowance = Math.max(0, toNumber(input.internetAllowance ?? input.internet_allowance, 0))
  const otherAllowance = Math.max(0, toNumber(input.otherAllowance ?? input.other_allowance, 0))

  const autoGross =
    basicSalary +
    houseRentAllowance +
    dearnessAllowance +
    conveyanceAllowance +
    medicalAllowance +
    specialAllowance +
    travelAllowance +
    internetAllowance +
    otherAllowance

  const grossSalary = Math.max(0, toNumber(input.grossSalary ?? input.gross_salary, autoGross || monthlySalary))

  return {
    monthlySalary,
    workingDaysInMonth,
    perDaySalary,
    basicSalary,
    houseRentAllowance,
    dearnessAllowance,
    conveyanceAllowance,
    medicalAllowance,
    specialAllowance,
    travelAllowance,
    internetAllowance,
    otherAllowance,
    grossSalary,
    pfApplicable: Math.max(0, toNumber(input.pfApplicable ?? input.pf_applicable, 0)),
    esiApplicable: Math.max(0, toNumber(input.esiApplicable ?? input.esi_applicable, 0)),
    professionalTaxApplicable: Math.max(0, toNumber(input.professionalTaxApplicable ?? input.professional_tax_applicable, 0)),
    // keep backward compatibility with existing code paths
    salaryPerday: perDaySalary,
  }
}

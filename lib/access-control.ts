export type UserRole = "admin" | "manager" | "technician" | "supervisor" | "accountant" | "office_staff" | "customer"

/** Roles that bypass the full dashboard and only access the mobile attendance form. */
export const OFFICE_ATTENDANCE_ROLES: UserRole[] = ["manager", "supervisor", "accountant", "office_staff"]

const accessMap: Record<UserRole, string[]> = {
  admin: [
    "dashboard",
    "new-job-card",
    "breakdown",
    "update-job-card",
    "delivered",
    "maintenance-tracker",
    "employee",
    "attendance-payroll",
    "inventory",
    "inventory-pos",
    "customers",
    "income-expense",
    "spare-parts",
    "whatsapp-messages",
    "settings",
    "all-notifications",
  ],
  manager: [
    "dashboard",
    "new-job-card",
    "breakdown",
    "update-job-card",
    "delivered",
    "maintenance-tracker",
    "attendance-payroll",
    "inventory",
    "inventory-pos",
    "customers",
    "income-expense",
    "spare-parts",
    "all-notifications",
  ],
  technician: [
    "dashboard",
    "breakdown",
    "attendance-payroll",
    "leave-request",
    "all-notifications",
  ],
  // Office roles — attendance only; the UI redirects them to /mobile-attendance
  supervisor: ["attendance-payroll"],
  accountant: ["attendance-payroll"],
  office_staff: ["attendance-payroll"],
  // Customers have no dashboard access
  customer: [],
}

export const isValidRole = (role: string): role is UserRole => {
  return (
    role === "admin" ||
    role === "manager" ||
    role === "technician" ||
    role === "supervisor" ||
    role === "accountant" ||
    role === "office_staff" ||
    role === "customer"
  )
}

export const getAllowedMenuIds = (role: UserRole) => {
  return accessMap[role]
}

export const canAccessMenu = (role: UserRole, menuId: string) => {
  return accessMap[role].includes(menuId)
}

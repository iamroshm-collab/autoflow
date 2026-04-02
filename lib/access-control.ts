export type UserRole = "admin" | "manager" | "technician"

const accessMap: Record<UserRole, string[]> = {
  admin: [
    "dashboard",
    "new-job-card",
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
    "attendance-payroll",
    "all-notifications",
  ],
}

export const isValidRole = (role: string): role is UserRole => {
  return role === "admin" || role === "manager" || role === "technician"
}

export const getAllowedMenuIds = (role: UserRole) => {
  return accessMap[role]
}

export const canAccessMenu = (role: UserRole, menuId: string) => {
  return accessMap[role].includes(menuId)
}
